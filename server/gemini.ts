import { ENV } from "./_core/env";
import { type InvokeParams, type InvokeResult, type MessageContent, type StreamInvokeParams } from "./_core/llm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const STABLE_GEMINI_FLASH_MODEL = "models/gemini-flash-latest";

type GeminiModelCatalog = { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
export type GeminiRoute = "initial" | "followup";

function messageText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts.map(part => typeof part === "string" ? part : part.type === "text" ? part.text : "").filter(Boolean).join("\n");
}

function geminiParts(content: MessageContent | MessageContent[]): Array<Record<string, unknown>> {
  const parts = Array.isArray(content) ? content : [content];
  const output: Array<Record<string, unknown>> = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) output.push({ text: part });
      continue;
    }
    if (part.type === "text") {
      if (part.text) output.push({ text: part.text });
      continue;
    }
    if (part.type === "image_url") {
      const match = part.image_url.url.match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
      output.push(match ? { inlineData: { mimeType: match[1], data: match[2] } } : { text: "[Image reference unavailable]" });
    }
  }
  return output;
}

function toGeminiResponseSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGeminiResponseSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["additionalProperties", "pattern", "$schema"].includes(key))
      .map(([key, nested]) => [key, toGeminiResponseSchema(nested)])
  );
}

function configuredModelName(route: GeminiRoute = "followup") {
  const model = route === "initial" ? ENV.geminiInitialModel : ENV.geminiFollowupModel;
  return model.startsWith("models/") ? model : `models/${model}`;
}

function modelCandidates(route: GeminiRoute) {
  return Array.from(new Set([configuredModelName(route), STABLE_GEMINI_FLASH_MODEL]));
}

export function isGeminiConfigured() {
  return Boolean(ENV.geminiApiKey);
}

export class GeminiProviderError extends Error {
  readonly status: number;
  readonly retryAfterSeconds?: number;
  constructor(status: number, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function isRetiredModelError(error: GeminiProviderError) {
  return /model.+no longer available|no longer available to new users|deprecated model|model.+retired/i.test(error.message);
}

async function geminiError(response: Response) {
  const text = await response.text();
  let message = text;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    message = parsed.error?.message || text;
  } catch {
    // Preserve non-JSON error content without exposing credentials.
  }
  const retryAfterSeconds = Number(message.match(/retry in\s+([\d.]+)s/i)?.[1]);
  return new GeminiProviderError(response.status, `Gemini request failed: ${message}`, Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined);
}

function createGeminiRequest(params: InvokeParams) {
  const systemInstruction = params.messages.filter(message => message.role === "system").map(message => messageText(message.content)).filter(Boolean).join("\n\n");
  const contents: Array<{ role: "model" | "user"; parts: Array<Record<string, unknown>> }> = params.messages.filter(message => message.role !== "system" && message.role !== "tool" && message.role !== "function").map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: geminiParts(message.content) as Array<Record<string, unknown>>,
  }));
  const responseFormat = params.response_format || params.responseFormat;
  const schema = params.output_schema || params.outputSchema || (responseFormat?.type === "json_schema" ? responseFormat.json_schema : undefined);
  const responseSchema = schema?.schema || schema;
  const geminiResponseSchema = responseSchema ? toGeminiResponseSchema(responseSchema) : undefined;
  const jsonInstruction = responseSchema ? `Return only valid JSON matching this schema: ${JSON.stringify(responseSchema)}` : "";
  return {
    systemInstruction: systemInstruction || jsonInstruction ? { parts: [{ text: [systemInstruction, jsonInstruction].filter(Boolean).join("\n\n") }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: params.max_tokens ?? params.maxTokens,
      responseMimeType: responseSchema || responseFormat?.type === "json_object" ? "application/json" : undefined,
      responseSchema: geminiResponseSchema,
    },
  };
}

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function invokeGemini(params: InvokeParams, route: GeminiRoute = "followup"): Promise<InvokeResult> {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const retryDelays = [2_000, 4_000, 8_000];
  const requestTimeoutMs = route === "followup" ? 20_000 : 45_000;
  for (const modelName of modelCandidates(route)) {
    for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      let response: Response;
      try {
        response = await fetch(`${GEMINI_API_BASE}/${modelName}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(createGeminiRequest(params)),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new GeminiProviderError(504, "Gemini did not respond within the expected time.");
        throw error;
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        const error = await geminiError(response);
        if (error.status === 429 && attempt < retryDelays.length) {
          await delay(retryDelays[attempt]);
          continue;
        }
        if (isRetiredModelError(error) && modelName !== STABLE_GEMINI_FLASH_MODEL) break;
        throw error;
      }
      const payload = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };
      const candidate = payload.candidates?.[0];
      const content = candidate?.content?.parts?.map(part => part.text || "").join("") || "";
      if (!content) throw new GeminiProviderError(502, "Gemini returned no generated text.");
      const usage = payload.usageMetadata;
      return {
        id: `gemini-${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        model: modelName.replace(/^models\//, ""),
        choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: candidate?.finishReason?.toLowerCase() === "stop" ? "stop" : candidate?.finishReason?.toLowerCase() || "stop" }],
        usage: {
          prompt_tokens: usage?.promptTokenCount ?? 0,
          completion_tokens: usage?.candidatesTokenCount ?? 0,
          total_tokens: usage?.totalTokenCount ?? 0,
        },
      };
    }
  }
  throw new GeminiProviderError(503, "Gemini could not complete this request with a supported model.");
}

export async function invokeGeminiStream(params: StreamInvokeParams, route: GeminiRoute = "followup"): Promise<Response> {
  const result = await invokeGemini(params, route);
  const event = JSON.stringify({ id: result.id, choices: [{ index: 0, delta: { content: result.choices[0]?.message.content || "" }, finish_reason: "stop" }] });
  return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
}

export async function validateGeminiModel(route: GeminiRoute = "followup") {
  if (!isGeminiConfigured()) return false;
  const response = await fetch(`${GEMINI_API_BASE}/models?key=${encodeURIComponent(ENV.geminiApiKey)}`);
  if (!response.ok) throw await geminiError(response);
  const catalog = await response.json() as GeminiModelCatalog;
  return catalog.models?.some(model => model.name === configuredModelName(route) && model.supportedGenerationMethods?.includes("generateContent")) ?? false;
}
