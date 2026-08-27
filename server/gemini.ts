import { ENV } from "./_core/env";
import { type InvokeParams, type InvokeResult, type MessageContent, type StreamInvokeParams } from "./_core/llm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const STABLE_GEMINI_FLASH_MODEL = "models/gemini-flash-latest";

type GeminiModelCatalog = { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
export type GeminiRoute = "initial" | "followup";
export type GeminiBackgroundStatus = "in_progress" | "requires_action" | "completed" | "failed" | "cancelled";
export type GeminiBackgroundInteraction = { id: string; status: GeminiBackgroundStatus; model?: string; outputText?: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; errorMessage?: string };

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

function interactionParts(content: MessageContent | MessageContent[]): Array<Record<string, unknown>> {
  const parts = Array.isArray(content) ? content : [content];
  const output: Array<Record<string, unknown>> = [];
  for (const part of parts) {
    if (typeof part === "string") {
      if (part) output.push({ type: "text", text: part });
      continue;
    }
    if (part.type === "text") {
      if (part.text) output.push({ type: "text", text: part.text });
      continue;
    }
    if (part.type === "image_url") {
      const match = part.image_url.url.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      output.push(match
        ? { type: "image", data: match[2], mime_type: match[1] }
        : { type: "text", text: "[Référence d’image indisponible]" });
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

function createGeminiInteractionRequest(params: InvokeParams, route: GeminiRoute) {
  const systemInstruction = params.messages.filter(message => message.role === "system").map(message => messageText(message.content)).filter(Boolean).join("\n\n");
  const input = params.messages
    .filter(message => message.role !== "system" && message.role !== "tool" && message.role !== "function")
    .flatMap(message => {
      const parts = interactionParts(message.content);
      const text = parts.filter(part => part.type === "text" && typeof part.text === "string").map(part => String(part.text)).join("\n");
      const media = parts.filter(part => part.type === "image");
      return [
        ...(text ? [{ type: "text", text: `${message.role === "assistant" ? "Assistant" : "Utilisateur"}: ${text}` }] : []),
        ...media,
      ];
    });
  const responseFormat = params.response_format || params.responseFormat;
  const schema = params.output_schema || params.outputSchema || (responseFormat?.type === "json_schema" ? responseFormat.json_schema : undefined);
  const responseSchema = schema?.schema || schema;
  return {
    model: configuredModelName(route).replace(/^models\//, ""),
    input,
    system_instruction: systemInstruction || undefined,
    response_format: responseSchema ? { type: "text", mime_type: "application/json", schema: toGeminiResponseSchema(responseSchema) } : undefined,
    generation_config: { max_output_tokens: Math.min(params.max_tokens ?? params.maxTokens ?? 20_000, 20_000) },
    background: true,
    store: true,
  };
}

function parseBackgroundInteraction(payload: Record<string, unknown>): GeminiBackgroundInteraction {
  const status = String(payload.status || "failed").toLowerCase() as GeminiBackgroundStatus;
  const steps = Array.isArray(payload.steps) ? payload.steps : [];
  const outputText = typeof payload.output_text === "string"
    ? payload.output_text
    : steps.flatMap(step => {
      const content = step && typeof step === "object" ? (step as { content?: unknown }).content : undefined;
      return Array.isArray(content) ? content.map(part => part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string" ? (part as { text: string }).text : "") : [];
    }).join("");
  const usage = payload.usage && typeof payload.usage === "object" ? payload.usage as Record<string, unknown> : undefined;
  const error = payload.error && typeof payload.error === "object" ? payload.error as { message?: unknown } : undefined;
  return {
    id: String(payload.id || ""),
    status: ["in_progress", "requires_action", "completed", "failed", "cancelled"].includes(status) ? status : "failed",
    model: typeof payload.model === "string" ? payload.model : undefined,
    outputText: outputText || undefined,
    usage: {
      prompt_tokens: Number(usage?.total_input_tokens ?? 0) || 0,
      completion_tokens: Number(usage?.total_output_tokens ?? 0) || 0,
      total_tokens: Number(usage?.total_tokens ?? 0) || 0,
    },
    errorMessage: typeof error?.message === "string" ? error.message : undefined,
  };
}

export async function createGeminiBackgroundInteraction(params: InvokeParams, route: GeminiRoute = "followup") {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const response = await fetch(`${GEMINI_API_BASE}/interactions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": ENV.geminiApiKey, "api-revision": "2026-05-20" },
    body: JSON.stringify(createGeminiInteractionRequest(params, route)),
  });
  if (!response.ok) throw await geminiError(response);
  const interaction = parseBackgroundInteraction(await response.json() as Record<string, unknown>);
  if (!interaction.id) throw new GeminiProviderError(502, "Gemini did not return a background interaction identifier.");
  return interaction;
}

export async function getGeminiBackgroundInteraction(interactionId: string) {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const response = await fetch(`${GEMINI_API_BASE}/interactions/${encodeURIComponent(interactionId)}`, { headers: { "x-goog-api-key": ENV.geminiApiKey, "api-revision": "2026-05-20" } });
  if (!response.ok) throw await geminiError(response);
  return parseBackgroundInteraction(await response.json() as Record<string, unknown>);
}

export async function cancelGeminiBackgroundInteraction(interactionId: string) {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const response = await fetch(`${GEMINI_API_BASE}/interactions/${encodeURIComponent(interactionId)}/cancel`, { method: "POST", headers: { "x-goog-api-key": ENV.geminiApiKey, "api-revision": "2026-05-20" } });
  if (!response.ok) throw await geminiError(response);
  return parseBackgroundInteraction(await response.json() as Record<string, unknown>);
}

const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

export async function invokeGemini(params: InvokeParams, route: GeminiRoute = "followup"): Promise<InvokeResult> {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const retryDelays = route === "followup" ? [1_000, 2_500] : [2_000, 4_000, 8_000];
  const requestTimeoutMs = route === "followup" ? 14_000 : 45_000;
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
        const providerError = controller.signal.aborted
          ? new GeminiProviderError(504, "Gemini did not respond within the expected time.")
          : new GeminiProviderError(503, error instanceof Error ? `Gemini network request failed: ${error.message}` : "Gemini network request failed.");
        if (attempt < retryDelays.length) {
          await delay(retryDelays[attempt]);
          continue;
        }
        throw providerError;
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        const error = await geminiError(response);
        if ((error.status === 429 || error.status >= 500) && attempt < retryDelays.length) {
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
