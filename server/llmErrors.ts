import { TRPCError } from "@trpc/server";
import { LlmProviderQuotaError, LlmProviderRequestError } from "./_core/llm";
import { GeminiProviderError } from "./gemini";

export function getLlmUserMessage(error: unknown) {
  if (error instanceof GeminiProviderError) {
    return "Gemini could not complete this request. Check the configured Gemini API key, enabled model, and provider quota, then retry.";
  }
  if (error instanceof LlmProviderQuotaError) {
    return "Generation is temporarily unavailable because the external built-in LLM account linked to this Lakay project has exhausted its usage. Lakay project credits are separate and were not charged for this failed request. Restore usage for the project's Manus built-in LLM account, then try again.";
  }
  if (error instanceof LlmProviderRequestError) {
    return "The external LLM provider could not complete this request. Please retry shortly. If the problem persists, check the project's built-in LLM provider configuration and usage.";
  }
  return null;
}

export function rethrowLlmError(error: unknown): never {
  const message = getLlmUserMessage(error);
  if (message) throw new TRPCError({ code: "PRECONDITION_FAILED", message });
  throw error;
}
