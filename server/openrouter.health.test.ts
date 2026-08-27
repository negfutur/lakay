import { describe, expect, it } from "vitest";

describe("OpenRouter server credential", () => {
  it("authenticates a lightweight server-side model-list health check", async () => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    expect(apiKey).toMatch(/^sk-or-/);

    const response = await fetch("https://openrouter.ai/api/v1/models?limit=1", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = await response.json() as { data?: unknown; error?: { message?: string } };

    expect(response.ok, payload.error?.message || `OpenRouter health check failed with HTTP ${response.status}`).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
  }, 15_000);
});
