import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return { ...actual, invokeLLM: vi.fn(), listLLMModels: vi.fn() };
});
vi.mock("./gemini", () => ({
  isGeminiConfigured: vi.fn(() => true),
  invokeGemini: vi.fn(),
  invokeGeminiStream: vi.fn(),
}));

import { invokeLLM, listLLMModels, LlmProviderQuotaError, LlmProviderRequestError } from "./_core/llm";
import { invokeGemini } from "./gemini";
import { invokeLakayWithFallback } from "./projectPlanning";

afterEach(() => vi.clearAllMocks());

describe("Lakay LLM runtime fallback", () => {
  it("uses an available alternate model after a retryable provider failure", async () => {
    vi.mocked(listLLMModels).mockResolvedValue({ object: "list", data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] } as never);
    vi.mocked(invokeLLM)
      .mockRejectedValueOnce(new LlmProviderRequestError({ status: 503, message: "temporary provider outage" }))
      .mockResolvedValueOnce({ id: "fallback", created: 1, model: "gpt-5-mini", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gpt-5-mini" });
    expect(vi.mocked(invokeLLM).mock.calls.map(call => call[0].model)).toEqual(["gpt-5", "gpt-5-mini"]);
  });

  it("does not attempt alternate built-in models when the configured provider account returns 412 Code09 exhaustion, and uses Gemini instead", async () => {
    vi.mocked(listLLMModels).mockResolvedValue({ object: "list", data: [{ id: "gpt-5" }, { id: "gpt-5-mini" }] } as never);
    const quotaError = new LlmProviderQuotaError("your account has hit a usage exhausted", 9);
    vi.mocked(invokeLLM).mockRejectedValueOnce(quotaError);
    vi.mocked(invokeGemini).mockResolvedValue({ id: "gemini", created: 1, model: "gemini-3.6-flash", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gemini-3.6-flash" });
    expect(vi.mocked(invokeLLM).mock.calls).toHaveLength(1);
    expect(vi.mocked(invokeLLM).mock.calls[0]?.[0].model).toBe("gpt-5");
    expect(vi.mocked(invokeGemini)).toHaveBeenCalledTimes(1);
  });
});
