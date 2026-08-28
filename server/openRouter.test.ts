import { afterEach, describe, expect, it, vi } from "vitest";
import { getOpenRouterHealth, invokeOpenRouter, resetOpenRouterRuntimeForTests, selectOpenRouterModels } from "./openRouter";

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

  it("pauses the route after confirmed external credit exhaustion instead of repeating a 402 on every Lakay request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Insufficient credits. This account never purchased credits." } }), { status: 402, statusText: "Payment Required" }));
    vi.stubGlobal("fetch", fetchMock);
    const request = { model: "qwen/qwen3.8-flash", messages: [{ role: "user" as const, content: "Bonjour" }] };

    await expect(invokeOpenRouter(request)).rejects.toThrow("OpenRouter 402");
    const callsAfterQuota = fetchMock.mock.calls.length;
    await expect(invokeOpenRouter(request)).rejects.toThrow("mis en pause");

    expect(getOpenRouterHealth().state).toBe("open");
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterQuota);
  });

  it("prioritizes the approved Gemma 4 31B free route with free capable reserves", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [
      { id: "google/gemma-4-31b-it:free", architecture: { input_modalities: ["text"] } },
      { id: "z-ai/glm-5.2:free", architecture: { input_modalities: ["text"] } },
      { id: "minimax/minimax-m3:free", architecture: { input_modalities: ["text"] } },
    ] }), { status: 200 })));

    await expect(selectOpenRouterModels({ quality: "high" })).resolves.toEqual([
      "google/gemma-4-31b-it:free",
      "z-ai/glm-5.2:free",
      "minimax/minimax-m3:free",
    ]);
  });

  it("moves from a shared-pool free rate limit to the next free model without retrying the same route", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [
        { id: "google/gemma-4-31b-it:free", architecture: { input_modalities: ["text"] } },
        { id: "minimax/minimax-m3:free", architecture: { input_modalities: ["text"] } },
      ] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "google/gemma-4-31b-it:free is temporarily rate-limited upstream." } }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "response", model: "minimax/minimax-m3:free", choices: [{ index: 0, message: { role: "assistant", content: "OK" }, finish_reason: "stop" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(invokeOpenRouter({ messages: [{ role: "user", content: "Bonjour" }] }, { quality: "high" })).resolves.toMatchObject({ model: "minimax/minimax-m3:free" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
