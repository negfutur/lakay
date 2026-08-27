import { afterEach, describe, expect, it, vi } from "vitest";
import { getOpenRouterHealth, invokeOpenRouter, resetOpenRouterRuntimeForTests } from "./openRouter";

describe("OpenRouter provider adapter", () => {
  afterEach(() => {
    resetOpenRouterRuntimeForTests();
    vi.unstubAllGlobals();
  });

  it("keeps requests server-side and returns an OpenAI-compatible completion", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "response", created: 1, model: "qwen/qwen3.8-flash", choices: [{ index: 0, message: { role: "assistant", content: "Bonjour" }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeOpenRouter({ model: "qwen/qwen3.8-flash", messages: [{ role: "user", content: "Bonjour" }] })).resolves.toMatchObject({ model: "qwen/qwen3.8-flash" });
    expect(fetchMock).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({ method: "POST" }));
    expect(getOpenRouterHealth().state).toBe("healthy");
  });

  it("opens the circuit after repeated retryable failures instead of repeatedly calling a known-bad provider", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ error: { message: "temporary outage" } }), { status: 503, statusText: "Unavailable" })));
    vi.stubGlobal("fetch", fetchMock);
    const request = { model: "qwen/qwen3.8-flash", messages: [{ role: "user" as const, content: "Bonjour" }] };

    await expect(invokeOpenRouter(request)).rejects.toThrow("OpenRouter 503");
    await expect(invokeOpenRouter(request)).rejects.toThrow("OpenRouter 503");
    const callsBeforeCircuit = fetchMock.mock.calls.length;

    await expect(invokeOpenRouter(request)).rejects.toThrow("mis en pause");
    expect(getOpenRouterHealth().state).toBe("open");
    expect(fetchMock).toHaveBeenCalledTimes(callsBeforeCircuit);
  }, 10_000);
});
