import { invokeLLM, invokeLLMStream, isRetryableStatus, listLLMModels, LlmProviderQuotaError, LlmProviderRequestError, type InvokeParams, type InvokeResult, type StreamInvokeParams } from "./_core/llm";
import { invokeGemini, invokeGeminiStream, isGeminiConfigured, type GeminiRoute } from "./gemini";

const DEFAULT_MODEL_ORDER = ["gpt-5", "claude-sonnet-4-6", "gpt-5-mini", "claude-haiku-4-5"];

export async function selectAvailableLakayModels(preferredModels = DEFAULT_MODEL_ORDER): Promise<string[]> {
  const { data } = await listLLMModels();
  const available = new Set(data.map(model => model.id));
  const preferred = preferredModels.filter(id => available.has(id));
  return preferred.length ? preferred : data.map(model => model.id);
}

function canTryFallback(error: unknown) {
  return error instanceof LlmProviderRequestError && !(error instanceof LlmProviderQuotaError) && isRetryableStatus(error.status);
}

export async function invokeProviderFallback(params: Omit<InvokeParams, "model"> & { model?: string; preferGemini?: boolean; geminiRoute?: GeminiRoute; preferredModels?: string[] }): Promise<InvokeResult> {
  const { preferGemini = false, geminiRoute = "followup", preferredModels, ...invokeParams } = params;
  let geminiError: unknown;
  if (preferGemini && isGeminiConfigured()) {
    try {
      return await invokeGemini(invokeParams, geminiRoute);
    } catch (error) {
      geminiError = error;
    }
  }
  let models: string[] = [];
  try {
    models = invokeParams.model ? [invokeParams.model, ...(await selectAvailableLakayModels(preferredModels)).filter(model => model !== invokeParams.model)] : await selectAvailableLakayModels(preferredModels);
  } catch (error) {
    if (isGeminiConfigured() && !preferGemini) return invokeGemini(invokeParams, geminiRoute);
    throw geminiError ?? error;
  }
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLM({ ...invokeParams, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) {
        if (isGeminiConfigured()) return invokeGemini(invokeParams, geminiRoute);
        throw error;
      }
    }
  }
  if (isGeminiConfigured() && !preferGemini) return invokeGemini(invokeParams, geminiRoute);
  throw lastError instanceof Error ? lastError : geminiError instanceof Error ? geminiError : new Error("No Lakay LLM fallback model completed the request.");
}

export async function invokeProviderStreamFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string; preferredModels?: string[] }) {
  let models: string[] = [];
  try {
    models = params.model ? [params.model, ...(await selectAvailableLakayModels(params.preferredModels)).filter(model => model !== params.model)] : await selectAvailableLakayModels(params.preferredModels);
  } catch (error) {
    if (isGeminiConfigured()) return invokeGeminiStream(params);
    throw error;
  }
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLMStream({ ...params, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) {
        if (isGeminiConfigured()) return invokeGeminiStream(params);
        throw error;
      }
    }
  }
  if (isGeminiConfigured()) return invokeGeminiStream(params);
  throw lastError instanceof Error ? lastError : new Error("No Lakay LLM fallback model completed the stream request.");
}
