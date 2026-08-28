import { ENV } from "./_core/env";
import { invokeLLM, invokeLLMStream, isRetryableStatus, listLLMModels, LlmProviderQuotaError, LlmProviderRequestError, type InvokeParams, type InvokeResult, type StreamInvokeParams } from "./_core/llm";
import { invokeGemini, invokeGeminiStream, isGeminiConfigured, GeminiProviderError, type GeminiRoute } from "./gemini";
import { invokeOpenRouter, invokeOpenRouterStream, isOpenRouterConfigured, isRetryableOpenRouterStatus, OpenRouterProviderError, type OpenRouterQuality } from "./openRouter";

const DEFAULT_MODEL_ORDER = ["gpt-5", "claude-sonnet-4-6", "gpt-5-mini", "claude-haiku-4-5"];

export type LakayProviderName = "gemini" | "openrouter" | "forge";
export type LakayProviderResult = InvokeResult & { lakayProvider: LakayProviderName };
type ProviderOptions = { preferGemini?: boolean; geminiRoute?: GeminiRoute; preferredModels?: string[]; openRouterQuality?: OpenRouterQuality; needsVision?: boolean; needsStructuredOutput?: boolean; providers?: LakayProviderName[]; onProviderAttempt?: (provider: LakayProviderName) => void | Promise<void> };

export async function selectAvailableLakayModels(preferredModels = DEFAULT_MODEL_ORDER): Promise<string[]> {
  const { data } = await listLLMModels();
  const available = new Set(data.map(model => model.id));
  const preferred = preferredModels.filter(id => available.has(id));
  return preferred.length ? preferred : data.map(model => model.id);
}

function canTryFallback(error: unknown) {
  if (error instanceof LlmProviderRequestError) return !(error instanceof LlmProviderQuotaError) && isRetryableStatus(error.status);
  if (error instanceof GeminiProviderError) return isRetryableStatus(error.status);
  if (error instanceof OpenRouterProviderError) return isRetryableOpenRouterStatus(error.status);
  return false;
}

function withProvider(result: InvokeResult, lakayProvider: LakayProviderName): LakayProviderResult {
  return { ...result, lakayProvider };
}

async function invokeGeminiWithProFallback(params: Omit<InvokeParams, "model"> & { model?: string }, route: GeminiRoute) {
  try {
    return await invokeGemini(params, route);
  } catch (flashError) {
    if (route === "pro" || !canTryFallback(flashError)) throw flashError;
    return invokeGemini(params, "pro");
  }
}

async function invokeGeminiStreamWithProFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string }, route: GeminiRoute) {
  try {
    return await invokeGeminiStream(params, route);
  } catch (flashError) {
    if (route === "pro" || !canTryFallback(flashError)) throw flashError;
    return invokeGeminiStream(params, "pro");
  }
}

function providerOrder(providers?: LakayProviderName[]): LakayProviderName[] {
  return providers?.length ? providers : ["gemini", "openrouter", "forge"];
}

async function invokeForgeFallback(params: Omit<InvokeParams, "model"> & { model?: string; preferredModels?: string[] }) {
  const { preferredModels, ...invokeParams } = params;
  const models = invokeParams.model
    ? [invokeParams.model, ...(await selectAvailableLakayModels(preferredModels)).filter(model => model !== invokeParams.model)]
    : await selectAvailableLakayModels(preferredModels);
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLM({ ...invokeParams, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No Lakay Forge model completed the request.");
}

async function invokeForgeStreamFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string; preferredModels?: string[] }) {
  const { preferredModels, ...invokeParams } = params;
  const models = invokeParams.model
    ? [invokeParams.model, ...(await selectAvailableLakayModels(preferredModels)).filter(model => model !== invokeParams.model)]
    : await selectAvailableLakayModels(preferredModels);
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLMStream({ ...invokeParams, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("No Lakay Forge model completed the stream request.");
}

export async function invokeProviderFallback(params: Omit<InvokeParams, "model"> & { model?: string } & ProviderOptions): Promise<LakayProviderResult> {
  const { preferGemini: _preferGemini = true, geminiRoute = "followup", preferredModels, openRouterQuality = "balanced", needsVision = false, needsStructuredOutput = false, providers, onProviderAttempt, ...invokeParams } = params;
  let lastError: unknown;
  for (const provider of providerOrder(providers)) {
    if (provider === "gemini" && !isGeminiConfigured()) continue;
    if (provider === "openrouter" && !isOpenRouterConfigured()) continue;
    if (provider === "forge" && !ENV.forgeApiKey) continue;
    try {
      await onProviderAttempt?.(provider);
      if (provider === "gemini") return withProvider(await invokeGeminiWithProFallback(invokeParams, geminiRoute), provider);
      if (provider === "openrouter") return withProvider(await invokeOpenRouter(invokeParams, { quality: openRouterQuality, needsVision, needsStructuredOutput }), provider);
      return withProvider(await invokeForgeFallback({ ...invokeParams, preferredModels }), provider);
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Aucun fournisseur IA Lakay n’a pu répondre.");
}

export async function invokeProviderStreamFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string } & ProviderOptions) {
  const { preferGemini: _preferGemini = true, geminiRoute = "followup", preferredModels, openRouterQuality = "balanced", needsVision = false, needsStructuredOutput = false, providers, onProviderAttempt, ...invokeParams } = params;
  let lastError: unknown;
  for (const provider of providerOrder(providers)) {
    if (provider === "gemini" && !isGeminiConfigured()) continue;
    if (provider === "openrouter" && !isOpenRouterConfigured()) continue;
    if (provider === "forge" && !ENV.forgeApiKey) continue;
    try {
      await onProviderAttempt?.(provider);
      if (provider === "gemini") return await invokeGeminiStreamWithProFallback(invokeParams, geminiRoute);
      if (provider === "openrouter") return await invokeOpenRouterStream(invokeParams, { quality: openRouterQuality, needsVision, needsStructuredOutput });
      return await invokeForgeStreamFallback({ ...invokeParams, preferredModels });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Aucun fournisseur IA Lakay n’a pu ouvrir le flux.");
}
