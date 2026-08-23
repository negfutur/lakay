import { describe, expect, it } from "vitest";
import { validateGeminiModel } from "./gemini";

describe("Gemini server credential", () => {
  it("authenticates a server-only request to the Gemini model catalog", async () => {
    const key = process.env.GEMINI_API_KEY;
    expect(key).toBeTruthy();

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key || "")}`);
    expect(response.ok).toBe(true);

    const payload = await response.json() as { models?: Array<{ name?: string }> };
    expect(payload.models?.length).toBeGreaterThan(0);
  }, 20_000);

  it("confirms the configured Gemini model supports server-side generation", async () => {
    await expect(validateGeminiModel()).resolves.toBe(true);
  }, 20_000);
});
