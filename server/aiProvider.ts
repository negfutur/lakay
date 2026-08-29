import type { InvokeParams } from "./_core/llm";
import type { StreamInvokeParams } from "./_core/llm";
import { invokeProviderFallback, invokeProviderStreamFallback, type LakayProviderName, type LakayProviderResult } from "./aiProviderCore";

export type LakayAiTask = "planning" | "conversation" | "conversation_stream" | "build_initial" | "build_followup" | "image_analysis" | "image_generation" | "speech_to_text" | "text_to_speech" | "realtime_voice";
export type LakayAiCapability = "text" | "structured_output" | "coding" | "vision" | "image_generation" | "speech_to_text" | "text_to_speech" | "realtime_voice" | "streaming";

export type LakayProviderPolicy = {
  task: LakayAiTask;
  preferMultimodal?: boolean;
  requiredCapabilities?: LakayAiCapability[];
  quality?: "efficient" | "balanced" | "high";
};

function providerPolicy(policy: LakayProviderPolicy) {
  const premiumWork = ["planning", "build_initial"].includes(policy.task);
  const unavailableCapability = policy.requiredCapabilities?.find(capability => ["image_generation", "speech_to_text", "text_to_speech", "realtime_voice"].includes(capability));
  if (unavailableCapability) throw new Error(`La capacité ${unavailableCapability} n’est pas configurée dans Lakay.`);
  return {
    geminiRoute: premiumWork ? "pro" as const : "followup" as const,
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
): Promise<LakayProviderResult> {
  return invokeProviderFallback({
    ...params,
    ...providerPolicy(policy),
  });
}

/**
 * Continues a build through the other Gemini route after its first bounded route failed.
 */
export async function invokeLakayProviderAfterGemini(
  params: Omit<InvokeParams, "model"> & { model?: string },
  policy: LakayProviderPolicy,
  onProviderAttempt?: (provider: LakayProviderName) => void | Promise<void>,
): Promise<LakayProviderResult> {
  return invokeProviderFallback({
    ...params,
    ...providerPolicy(policy),
    geminiRoute: "pro",
    providers: ["gemini"],
    onProviderAttempt,
  });
}

export async function invokeLakayProviderStream(params: Omit<StreamInvokeParams, "model"> & { model?: string }, policy: LakayProviderPolicy) {
  const resolved = providerPolicy({ ...policy, requiredCapabilities: [...(policy.requiredCapabilities || []), "streaming"] });
  return invokeProviderStreamFallback({ ...params, ...resolved });
}
