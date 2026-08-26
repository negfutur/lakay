import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/env", () => ({
  ENV: {
    geminiApiKey: "test-key",
    geminiInitialModel: "gemini-3.6-flash",
    geminiFollowupModel: "gemini-2.5-flash",
  },
}));

import { invokeGemini } from "./gemini";

afterEach(() => vi.unstubAllGlobals());

describe("Gemini retired-model fallback", () => {
  it("retries an automatic initial build on the stable Flash alias when the configured model is retired", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "This model is no longer available to new users." } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await invokeGemini({ messages: [{ role: "user", content: "Create a useful V1." }] }, "initial");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("models/gemini-3.6-flash:generateContent");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("models/gemini-flash-latest:generateContent");
    expect(result.model).toBe("gemini-flash-latest");
    expect(result.choices[0]?.message.content).toBe("OK");
  });

  it("preserves a non-stop provider finish reason so callers can reject partial output", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "Une explication incomplète, c" }] }, finishReason: "MAX_TOKENS" }], usageMetadata: {} }), { status: 200 })));

    const result = await invokeGemini({ messages: [{ role: "user", content: "Pourquoi ?" }] });

    expect(result.choices[0]?.finish_reason).toBe("max_tokens");
  });
});
