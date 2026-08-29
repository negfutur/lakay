import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./gemini", () => ({
  isGeminiConfigured: vi.fn(() => true),
  invokeGemini: vi.fn(),
  invokeGeminiStream: vi.fn(),
  GeminiProviderError: class GeminiProviderError extends Error { constructor(readonly status: number, message: string) { super(message); } },
}));
import { GeminiProviderError, invokeGemini } from "./gemini";
import { invokeLakayWithFallback } from "./projectPlanning";

afterEach(() => vi.clearAllMocks());

describe("Lakay LLM runtime fallback", () => {
  it("uses the other Gemini route after a retryable first-route failure", async () => {
    vi.mocked(invokeGemini)
      .mockRejectedValueOnce(new GeminiProviderError(503, "Gemini Flash temporarily unavailable"))
      .mockResolvedValueOnce({ id: "gemini", created: 1, model: "gemini-pro", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gemini-pro", lakayProvider: "gemini" });
    expect(vi.mocked(invokeGemini).mock.calls.map(call => call[1])).toEqual(["followup", "pro"]);
  });

  it("keeps Gemini as the primary provider when it completes the request", async () => {
    vi.mocked(invokeGemini).mockResolvedValueOnce({ id: "gemini", created: 1, model: "gemini-flash", choices: [{ index: 0, message: { role: "assistant", content: "ready" }, finish_reason: "stop" }] } as never);

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).resolves.toMatchObject({ model: "gemini-flash", lakayProvider: "gemini" });
    expect(vi.mocked(invokeGemini)).toHaveBeenCalledTimes(1);
  });

  it("does not invoke an alternate provider after both Gemini routes fail", async () => {
    vi.mocked(invokeGemini)
      .mockRejectedValueOnce(new GeminiProviderError(503, "Gemini Flash temporarily unavailable"))
      .mockRejectedValueOnce(new GeminiProviderError(503, "Gemini Pro temporarily unavailable"));

    await expect(invokeLakayWithFallback({ messages: [{ role: "user", content: "Build a landing page" }] })).rejects.toThrow("Gemini Pro temporarily unavailable");
    expect(vi.mocked(invokeGemini).mock.calls.map(call => call[1])).toEqual(["followup", "pro"]);
  });
});
