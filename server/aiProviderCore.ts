import { isRetryableStatus, type InvokeParams, type InvokeResult, type StreamInvokeParams } from "./_core/llm";
import { invokeGemini, invokeGeminiStream, isGeminiConfigured, GeminiProviderError, type GeminiRoute } from "./gemini";

export type LakayProviderName = "gemini";
export type LakayProviderResult = InvokeResult & { lakayProvider: LakayProviderName };
type ProviderOptions = { geminiRoute?: GeminiRoute; providers?: LakayProviderName[]; onProviderAttempt?: (provider: LakayProviderName) => void | Promise<void> };

function canTryFallback(error: unknown) {
  if (error instanceof GeminiProviderError) return isRetryableStatus(error.status);
  return false;
}

function withProvider(result: InvokeResult, lakayProvider: LakayProviderName): LakayProviderResult {
  return { ...result, lakayProvider };
}

async function invokeGeminiWithRouteFallback(params: Omit<InvokeParams, "model"> & { model?: string }, route: GeminiRoute) {
  try {
    return await invokeGemini(params, route);
  } catch (primaryError) {
    if (!canTryFallback(primaryError)) throw primaryError;
    return invokeGemini(params, route === "pro" ? "followup" : "pro");
  }
}

async function invokeGeminiStreamWithRouteFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string }, route: GeminiRoute) {
  try {
    return await invokeGeminiStream(params, route);
  } catch (primaryError) {
    if (!canTryFallback(primaryError)) throw primaryError;
    return invokeGeminiStream(params, route === "pro" ? "followup" : "pro");
  }
}

function providerOrder(_providers?: LakayProviderName[]): LakayProviderName[] {
  return ["gemini"];
}

export async function invokeProviderFallback(params: Omit<InvokeParams, "model"> & { model?: string } & ProviderOptions): Promise<LakayProviderResult> {
  const { geminiRoute = "followup", providers, onProviderAttempt, ...invokeParams } = params;
  let lastError: unknown;
  for (const provider of providerOrder(providers)) {
    if (provider === "gemini" && !isGeminiConfigured()) continue;
    try {
      await onProviderAttempt?.(provider);
      return withProvider(await invokeGeminiWithRouteFallback(invokeParams, geminiRoute), provider);
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Aucun fournisseur IA Lakay n’a pu répondre.");
}

export async function invokeProviderStreamFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string } & ProviderOptions) {
  const { geminiRoute = "followup", providers, onProviderAttempt, ...invokeParams } = params;
  let lastError: unknown;
  for (const provider of providerOrder(providers)) {
    if (provider === "gemini" && !isGeminiConfigured()) continue;
    try {
      await onProviderAttempt?.(provider);
      return await invokeGeminiStreamWithRouteFallback(invokeParams, geminiRoute);
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Aucun fournisseur IA Lakay n’a pu ouvrir le flux.");
}
