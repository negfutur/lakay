import type { InvokeParams, InvokeResult } from "./_core/llm";
import { invokeLakayWithFallback } from "./projectPlanning";

export type LakayAiTask = "planning" | "conversation" | "build_initial" | "build_followup";

export type LakayProviderPolicy = {
  task: LakayAiTask;
  preferMultimodal?: boolean;
};

/**
 * Stable provider-neutral entry point for Lakay agent capabilities.
 * Provider selection and fallback remain server-side and can evolve without
 * making Builder Chat or Builder generation depend on a provider adapter.
 */
export async function invokeLakayProvider(
  params: Omit<InvokeParams, "model"> & { model?: string },
  policy: LakayProviderPolicy,
): Promise<InvokeResult> {
  const initial = policy.task === "planning" || policy.task === "build_initial";
  return invokeLakayWithFallback({
    ...params,
    preferGemini: policy.preferMultimodal ?? policy.task !== "conversation",
    geminiRoute: initial ? "initial" : "followup",
  });
}
