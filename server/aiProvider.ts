import type { InvokeParams, InvokeResult } from "./_core/llm";
import type { StreamInvokeParams } from "./_core/llm";
import { invokeProviderFallback, invokeProviderStreamFallback } from "./aiProviderCore";

export type LakayAiTask = "planning" | "conversation" | "conversation_stream" | "build_initial" | "build_followup" | "image_analysis" | "image_generation" | "speech_to_text" | "text_to_speech" | "realtime_voice";
export type LakayAiCapability = "text" | "structured_output" | "coding" | "vision" | "image_generation" | "speech_to_text" | "text_to_speech" | "realtime_voice" | "streaming";

export type LakayProviderPolicy = {
  task: LakayAiTask;
  preferMultimodal?: boolean;
  requiredCapabilities?: LakayAiCapability[];
  quality?: "efficient" | "balanced" | "high";
};

const EFFICIENT_MODELS = ["gpt-5-mini", "claude-haiku-4-5", "gpt-5", "claude-sonnet-4-6"];
const HIGH_QUALITY_MODELS = ["gpt-5", "claude-sonnet-4-6", "gpt-5-mini", "claude-haiku-4-5"];

function providerPolicy(policy: LakayProviderPolicy) {
  const needsVision = policy.preferMultimodal || policy.requiredCapabilities?.includes("vision") || policy.task === "image_analysis";
  const codeOrPlan = ["planning", "build_initial", "build_followup"].includes(policy.task);
  const unavailableCapability = policy.requiredCapabilities?.find(capability => ["image_generation", "speech_to_text", "text_to_speech", "realtime_voice"].includes(capability));
  if (unavailableCapability) throw new Error(`La capacité ${unavailableCapability} n’est pas configurée dans Lakay.`);
  return {
    preferGemini: needsVision || codeOrPlan,
    geminiRoute: policy.task === "planning" || policy.task === "build_initial" ? "initial" as const : "followup" as const,
    preferredModels: policy.quality === "efficient" || policy.task === "conversation" || policy.task === "conversation_stream" ? EFFICIENT_MODELS : HIGH_QUALITY_MODELS,
  };
}

/**
 * Stable provider-neutral entry point for Lakay agent capabilities.
 * Provider selection and fallback remain server-side and can evolve without
 * making Builder Chat or Builder generation depend on a provider adapter.
 */
export async function invokeLakayProvider(
  params: Omit<InvokeParams, "model"> & { model?: string },
  policy: LakayProviderPolicy,
): Promise<InvokeResult> {
  return invokeProviderFallback({
    ...params,
    ...providerPolicy(policy),
  });
}

export async function invokeLakayProviderStream(params: Omit<StreamInvokeParams, "model"> & { model?: string }, policy: LakayProviderPolicy) {
  const resolved = providerPolicy({ ...policy, requiredCapabilities: [...(policy.requiredCapabilities || []), "streaming"] });
  return invokeProviderStreamFallback({ ...params, preferredModels: resolved.preferredModels });
}
