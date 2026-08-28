import { ENV } from "./_core/env";
import type { InvokeParams, InvokeResult, StreamInvokeParams } from "./_core/llm";

const OPENROUTER_API_BASE = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 45_000;
const RETRY_DELAYS_MS = [350, 1_000];
const CIRCUIT_FAILURE_THRESHOLD = 2;
const CIRCUIT_COOLDOWN_MS = 45_000;
const QUOTA_CIRCUIT_COOLDOWN_MS = 10 * 60_000;
const MODEL_CACHE_MS = 5 * 60_000;

export type OpenRouterQuality = "efficient" | "balanced" | "high";
export type OpenRouterHealth = { provider: "openrouter"; configured: boolean; state: "healthy" | "degraded" | "open" | "unknown"; consecutiveFailures: number; retryAt?: number };

type OpenRouterModel = {
  id: string;
  architecture?: { input_modalities?: string[] };
  supported_parameters?: string[];
  benchmarks?: { artificial_analysis?: { coding_index?: number; intelligence_index?: number } };
};

type CircuitState = { consecutiveFailures: number; openUntil?: number; lastSuccessAt?: number; lastFailureAt?: number };

let circuit: CircuitState = { consecutiveFailures: 0 };
let modelCache: { expiresAt: number; models: OpenRouterModel[] } | undefined;

export class OpenRouterProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "OpenRouterProviderError";
    this.status = status;
  }
}

export function isOpenRouterConfigured() {
  return Boolean(ENV.openRouterApiKey);
}

export function isRetryableOpenRouterStatus(status: number) {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 524 || status === 529 || status >= 500;
}

export function isOpenRouterCreditExhausted(error: unknown) {
  return error instanceof OpenRouterProviderError && error.status === 402 && /insufficient credits|never purchased credits|credit balance|payment required/i.test(error.message);
}

function isSharedFreeRouteRateLimit(error: unknown) {
  return error instanceof OpenRouterProviderError && error.status === 429 && /temporarily rate-limited upstream|shared[_ ]pool/i.test(error.message);
}

function circuitIsOpen() {
  if (!circuit.openUntil) return false;
  if (circuit.openUntil > Date.now()) return true;
  circuit = { ...circuit, openUntil: undefined, consecutiveFailures: 0 };
  return false;
}

function markSuccess() {
  circuit = { consecutiveFailures: 0, lastSuccessAt: Date.now() };
}

function markFailure(error: unknown) {
  if (isOpenRouterCreditExhausted(error)) {
    circuit = { consecutiveFailures: CIRCUIT_FAILURE_THRESHOLD, lastFailureAt: Date.now(), openUntil: Date.now() + QUOTA_CIRCUIT_COOLDOWN_MS };
    return;
  }
  if (!(error instanceof OpenRouterProviderError) || !isRetryableOpenRouterStatus(error.status)) return;
  const consecutiveFailures = circuit.consecutiveFailures + 1;
  circuit = { consecutiveFailures, lastFailureAt: Date.now(), openUntil: consecutiveFailures >= CIRCUIT_FAILURE_THRESHOLD ? Date.now() + CIRCUIT_COOLDOWN_MS : undefined };
}

export function getOpenRouterHealth(): OpenRouterHealth {
  if (!isOpenRouterConfigured()) return { provider: "openrouter", configured: false, state: "unknown", consecutiveFailures: 0 };
  if (circuitIsOpen()) return { provider: "openrouter", configured: true, state: "open", consecutiveFailures: circuit.consecutiveFailures, retryAt: circuit.openUntil };
  return { provider: "openrouter", configured: true, state: circuit.consecutiveFailures ? "degraded" : "healthy", consecutiveFailures: circuit.consecutiveFailures };
}

export function resetOpenRouterRuntimeForTests() {
  circuit = { consecutiveFailures: 0 };
  modelCache = undefined;
}

const wait = (milliseconds: number) => new Promise<void>(resolve => setTimeout(resolve, milliseconds));

function responseFormat(params: InvokeParams) {
  const explicit = params.response_format || params.responseFormat;
  if (explicit) return explicit;
  const schema = params.output_schema || params.outputSchema;
  return schema ? { type: "json_schema", json_schema: schema } : undefined;
}

function responseFormatIsUnsupported(error: unknown) {
  return error instanceof OpenRouterProviderError
    && error.status === 400
    && /response[_ ]format|structured[_ ]output|json[_ ]schema|json schema|does not support.*(?:json|schema|format)/i.test(error.message);
}

function withoutResponseFormat(params: InvokeParams): InvokeParams {
  const { response_format: _responseFormat, responseFormat: _responseFormatAlias, output_schema: _outputSchema, outputSchema: _outputSchemaAlias, ...fallbackParams } = params;
  return fallbackParams;
}

function makePayload(params: InvokeParams, model: string, stream = false) {
  const payload: Record<string, unknown> = { model, messages: params.messages, ...(stream ? { stream: true } : {}) };
  if (params.tools?.length) payload.tools = params.tools;
  if (params.tool_choice || params.toolChoice) payload.tool_choice = params.tool_choice || params.toolChoice;
  const maxTokens = params.max_tokens ?? params.maxTokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;
  if (params.reasoning) payload.reasoning = params.reasoning;
  const format = responseFormat(params);
  if (format) payload.response_format = format;
  return payload;
}

function headers() {
  return { authorization: `Bearer ${ENV.openRouterApiKey}`, "content-type": "application/json", "x-openrouter-title": "Lakay" };
}

async function request(url: string, init: RequestInit, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener("abort", abortFromCaller, { once: true });
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new OpenRouterProviderError(504, "OpenRouter n’a pas répondu dans le délai prévu.");
    throw new OpenRouterProviderError(503, error instanceof Error ? `OpenRouter indisponible : ${error.message}` : "OpenRouter est temporairement indisponible.");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function toProviderError(response: Response) {
  const text = await response.text();
  let detail = text;
  try {
    const json = JSON.parse(text) as { error?: { message?: string }; message?: string };
    detail = json.error?.message || json.message || text;
  } catch {
    // Retain a non-JSON diagnostic without exposing credentials.
  }
  return new OpenRouterProviderError(response.status, `OpenRouter ${response.status}: ${detail || response.statusText}`);
}

async function requestWithRetry(params: InvokeParams, model: string, stream = false, signal?: AbortSignal) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await request(`${OPENROUTER_API_BASE}/chat/completions`, { method: "POST", headers: headers(), body: JSON.stringify(makePayload(params, model, stream)) }, signal);
      if (response.ok) return response;
      const error = await toProviderError(response);
      lastError = error;
      if (isSharedFreeRouteRateLimit(error)) throw error;
      if (!isRetryableOpenRouterStatus(error.status) || attempt === RETRY_DELAYS_MS.length) throw error;
    } catch (error) {
      lastError = error;
      if (isSharedFreeRouteRateLimit(error)) throw error;
      if (error instanceof OpenRouterProviderError && error.status === 504) throw error;
      if (!(error instanceof OpenRouterProviderError) || !isRetryableOpenRouterStatus(error.status) || attempt === RETRY_DELAYS_MS.length) throw error;
    }
    await wait(RETRY_DELAYS_MS[attempt]);
  }
  throw lastError instanceof Error ? lastError : new OpenRouterProviderError(503, "OpenRouter n’a pas pu répondre.");
}

export async function listOpenRouterModels() {
  if (!isOpenRouterConfigured()) throw new OpenRouterProviderError(503, "OpenRouter n’est pas configuré.");
  if (modelCache && modelCache.expiresAt > Date.now()) return modelCache.models;
  const response = await request(`${OPENROUTER_API_BASE}/models?limit=1000`, { headers: headers() });
  if (!response.ok) throw await toProviderError(response);
  const payload = await response.json() as { data?: OpenRouterModel[] };
  const models = Array.isArray(payload.data) ? payload.data.filter(model => typeof model.id === "string") : [];
  modelCache = { models, expiresAt: Date.now() + MODEL_CACHE_MS };
  return models;
}

export async function healthCheckOpenRouter() {
  try {
    await listOpenRouterModels();
    markSuccess();
    return getOpenRouterHealth();
  } catch (error) {
    markFailure(error);
    throw error;
  }
}

export async function selectOpenRouterModels({ quality = "balanced", needsVision = false, needsStructuredOutput = false }: { quality?: OpenRouterQuality; needsVision?: boolean; needsStructuredOutput?: boolean } = {}) {
  const defaults: Record<OpenRouterQuality, string[]> = {
    efficient: ["google/gemma-4-31b-it:free", "minimax/minimax-m3:free", "z-ai/glm-5.2:free"],
    balanced: ["google/gemma-4-31b-it:free", "z-ai/glm-5.2:free", "minimax/minimax-m3:free"],
    high: ["google/gemma-4-31b-it:free", "z-ai/glm-5.2:free", "minimax/minimax-m3:free"],
  };
  try {
    const catalog = await listOpenRouterModels();
    const suitable = catalog.filter(model => {
      const input = model.architecture?.input_modalities || ["text"];
      const supportsVision = input.includes("image");
      return !needsVision || supportsVision;
    });
    const available = new Set(suitable.map(model => model.id));
    const preferred = defaults[quality].filter(model => available.has(model) || (!needsVision && !needsStructuredOutput && model.startsWith("~")));
    const ranked = suitable.sort((a, b) => ((b.benchmarks?.artificial_analysis?.coding_index || b.benchmarks?.artificial_analysis?.intelligence_index || 0) - (a.benchmarks?.artificial_analysis?.coding_index || a.benchmarks?.artificial_analysis?.intelligence_index || 0))).map(model => model.id);
    return Array.from(new Set([...preferred, ...ranked])).slice(0, 3);
  } catch (error) {
    if (error instanceof OpenRouterProviderError && !isRetryableOpenRouterStatus(error.status)) throw error;
    return defaults[quality];
  }
}

export async function invokeOpenRouter(params: InvokeParams, options: { quality?: OpenRouterQuality; needsVision?: boolean; needsStructuredOutput?: boolean } = {}): Promise<InvokeResult> {
  if (!isOpenRouterConfigured()) throw new OpenRouterProviderError(503, "OpenRouter n’est pas configuré pour Lakay.");
  if (circuitIsOpen()) throw new OpenRouterProviderError(503, "OpenRouter est temporairement mis en pause après plusieurs échecs.");
  let lastError: unknown;
  try {
    const models = params.model ? [params.model] : await selectOpenRouterModels(options);
    for (const model of models) {
      try {
        let response: Response;
        try {
          response = await requestWithRetry(params, model);
        } catch (error) {
          if (!responseFormatIsUnsupported(error)) throw error;
          response = await requestWithRetry(withoutResponseFormat(params), model);
        }
        const result = await response.json() as InvokeResult;
        if (!result.choices?.[0]?.message?.content) throw new OpenRouterProviderError(502, "OpenRouter a retourné une réponse vide.");
        markSuccess();
        return result;
      } catch (error) {
        lastError = error;
        if (!(error instanceof OpenRouterProviderError) || !isRetryableOpenRouterStatus(error.status)) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new OpenRouterProviderError(503, "Aucun modèle OpenRouter n’a pu répondre.");
  } catch (error) {
    markFailure(error);
    throw error;
  }
}

export async function invokeOpenRouterStream(params: StreamInvokeParams, options: { quality?: OpenRouterQuality; needsVision?: boolean; needsStructuredOutput?: boolean } = {}) {
  if (!isOpenRouterConfigured()) throw new OpenRouterProviderError(503, "OpenRouter n’est pas configuré pour Lakay.");
  if (circuitIsOpen()) throw new OpenRouterProviderError(503, "OpenRouter est temporairement mis en pause après plusieurs échecs.");
  let lastError: unknown;
  try {
    const models = params.model ? [params.model] : await selectOpenRouterModels(options);
    for (const model of models) {
      try {
        const response = await requestWithRetry(params, model, true, params.signal);
        markSuccess();
        return response;
      } catch (error) {
        lastError = error;
        if (!(error instanceof OpenRouterProviderError) || !isRetryableOpenRouterStatus(error.status)) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new OpenRouterProviderError(503, "Aucun modèle OpenRouter n’a pu répondre.");
  } catch (error) {
    markFailure(error);
    throw error;
  }
}
