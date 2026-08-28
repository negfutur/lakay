import { describe, expect, it } from "vitest";
import { createLlmHttpError, isRetryableStatus, LlmProviderQuotaError, LlmProviderRequestError } from "./_core/llm";
import { GeminiProviderError } from "./gemini";
import { OpenRouterProviderError } from "./openRouter";
import { getLlmUserMessage } from "./llmErrors";

describe("Lakay external LLM failure classification", () => {
  it("classifies the reproduced 412 Code09 payload as external provider usage exhaustion", () => {
    const error = createLlmHttpError(412, "Precondition Failed", JSON.stringify({ code: 9, message: "your account has hit a usage exhausted" }));

    expect(error).toBeInstanceOf(LlmProviderQuotaError);
    expect(error).toMatchObject({ status: 412, providerCode: 9 });
    expect(getLlmUserMessage(error)).toContain("external built-in LLM account");
    expect(getLlmUserMessage(error)).toContain("were not charged");
    expect(isRetryableStatus(412)).toBe(false);
  });

  it("keeps non-quota provider failures distinguishable and retry-safe for the caller", () => {
    const error = createLlmHttpError(503, "Service Unavailable", "temporarily unavailable");

    expect(error).toBeInstanceOf(LlmProviderRequestError);
    expect(error).not.toBeInstanceOf(LlmProviderQuotaError);
    expect(getLlmUserMessage(error)).toContain("external LLM provider");
  });

  it("explains a temporary Gemini rate limit without implying a completed build", () => {
    const message = getLlmUserMessage(new GeminiProviderError(429, "quota exceeded"));
    expect(message).toContain("momentanément limitée");
    expect(message).toContain("Aucun crédit Lakay");
  });

  it("turns an OpenRouter failure into a provider-neutral Chat recovery message", () => {
    const message = getLlmUserMessage(new OpenRouterProviderError(402, "Insufficient credits"));
    expect(message).toContain("Lakay n’a pas pu joindre une réponse IA");
    expect(message).not.toContain("OpenRouter");
    expect(message).not.toContain("Insufficient credits");
  });
});
