import { ENV } from "./_core/env";
import { type InvokeParams, type InvokeResult, type MessageContent, type StreamInvokeParams } from "./_core/llm";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GeminiModelCatalog = { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };

function messageText(content: MessageContent | MessageContent[]): string {
  const parts = Array.isArray(content) ? content : [content];
  return parts.map(part => typeof part === "string" ? part : part.type === "text" ? part.text : "").filter(Boolean).join("\n");
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

function configuredModelName() {
  return ENV.geminiModel.startsWith("models/") ? ENV.geminiModel : `models/${ENV.geminiModel}`;
}

export function isGeminiConfigured() {
  return Boolean(ENV.geminiApiKey);
}

export class GeminiProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GeminiProviderError";
    this.status = status;
  }
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
  return new GeminiProviderError(response.status, `Gemini request failed: ${message}`);
}

function createGeminiRequest(params: InvokeParams) {
  const systemInstruction = params.messages.filter(message => message.role === "system").map(message => messageText(message.content)).filter(Boolean).join("\n\n");
  const contents = params.messages.filter(message => message.role !== "system" && message.role !== "tool" && message.role !== "function").map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: messageText(message.content) }],
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

export async function invokeGemini(params: InvokeParams): Promise<InvokeResult> {
  if (!isGeminiConfigured()) throw new GeminiProviderError(503, "Gemini is not configured for this project.");
  const response = await fetch(`${GEMINI_API_BASE}/${configuredModelName()}:generateContent?key=${encodeURIComponent(ENV.geminiApiKey)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createGeminiRequest(params)),
  });
  if (!response.ok) throw await geminiError(response);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const content = payload.candidates?.[0]?.content?.parts?.map(part => part.text || "").join("") || "";
  if (!content) throw new GeminiProviderError(502, "Gemini returned no generated text.");
  return { id: `gemini-${Date.now()}`, created: Math.floor(Date.now() / 1000), model: ENV.geminiModel, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] };
}

export async function invokeGeminiStream(params: StreamInvokeParams): Promise<Response> {
  const result = await invokeGemini(params);
  const event = JSON.stringify({ id: result.id, choices: [{ index: 0, delta: { content: result.choices[0]?.message.content || "" }, finish_reason: "stop" }] });
  return new Response(`data: ${event}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache" } });
}

export async function validateGeminiModel() {
  if (!isGeminiConfigured()) return false;
  const response = await fetch(`${GEMINI_API_BASE}/models?key=${encodeURIComponent(ENV.geminiApiKey)}`);
  if (!response.ok) throw await geminiError(response);
  const catalog = await response.json() as GeminiModelCatalog;
  return catalog.models?.some(model => model.name === configuredModelName() && model.supportedGenerationMethods?.includes("generateContent")) ?? false;
}
