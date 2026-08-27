import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return { ...actual, invokeLLM: vi.fn(), listLLMModels: vi.fn() };
});
vi.mock("./gemini", () => ({
  isGeminiConfigured: vi.fn(() => true),
  invokeGemini: vi.fn(),
  invokeGeminiStream: vi.fn(),
  GeminiProviderError: class GeminiProviderError extends Error { constructor(readonly status: number, message: string) { super(message); } },
}));
vi.mock("./openRouter", () => ({
  isOpenRouterConfigured: vi.fn(() => false),
  isRetryableOpenRouterStatus: vi.fn((status: number) => status === 429 || status >= 500),
  invokeOpenRouter: vi.fn(),
  invokeOpenRouterStream: vi.fn(),
  OpenRouterProviderError: class OpenRouterProviderError extends Error { constructor(readonly status: number, message: string) { super(message); } },
}));

import { invokeLLM, listLLMModels, LlmProviderRequestError } from "./_core/llm";
import { GeminiProviderError, invokeGemini } from "./gemini";
import { invokeOpenRouter, isOpenRouterConfigured } from "./openRouter";
import { invokeLakayWithFallback } from "./projectPlanning";

afterEach(() => vi.clearAllMocks());

describe("Lakay LLM runtime fallback", () => {
  it("uses the compatible Forge fallback after retryable Gemini failure when OpenRouter is not configured", async () => {
    vi.mocked(invokeGemini).mockRejectedValueOnce(new GeminiProviderError(503, "Gemini temporarily unavailable"));
    vi.mocked(listLLMModels).mockResolvedValue({ object: "list", data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] } as never);
    vi.mocked(invokeLLM)
      .mockRejectedValueOnce(new LlmProviderRequestError({ status: 503, message: "temporary Forge outage" }))
      .mockResolvedValueOnce({ id: "forge", created: 1, model: "gpt-5-mini", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gpt-5-mini", lakayProvider: "forge" });
    expect(vi.mocked(invokeLLM).mock.calls.map(call => call[0].model)).toEqual(["gpt-5", "gpt-5-mini"]);
  });

  it("keeps Gemini as the primary provider when it completes the request", async () => {
    vi.mocked(invokeGemini).mockResolvedValueOnce({ id: "gemini", created: 1, model: "gemini-flash", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gemini-flash", lakayProvider: "gemini" });
    expect(vi.mocked(invokeLLM)).not.toHaveBeenCalled();
  });

  it("uses OpenRouter after a retryable Gemini failure without changing the invocation context", async () => {
    vi.mocked(isOpenRouterConfigured).mockReturnValue(true);
    vi.mocked(invokeGemini).mockRejectedValueOnce(new GeminiProviderError(503, "Gemini temporarily unavailable"));
    vi.mocked(invokeOpenRouter).mockResolvedValueOnce({ id: "openrouter", created: 1, model: "qwen/qwen3.8-flash", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "qwen/qwen3.8-flash", lakayProvider: "openrouter" });
    expect(vi.mocked(invokeOpenRouter)).toHaveBeenCalledWith(expect.objectContaining({ messages: [{ role: "user", content: "Build a landing page" }] }), expect.objectContaining({ quality: "balanced" }));
    expect(vi.mocked(invokeLLM)).not.toHaveBeenCalled();
  });
});
