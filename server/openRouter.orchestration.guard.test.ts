import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adapter = readFileSync(resolve(process.cwd(), "server/openRouter.ts"), "utf8");
const core = readFileSync(resolve(process.cwd(), "server/aiProviderCore.ts"), "utf8");
const env = readFileSync(resolve(process.cwd(), "server/_core/env.ts"), "utf8");

describe("OpenRouter multi-provider orchestration guard", () => {
  it("keeps the credential server-only and never exposes an OpenRouter Vite variable", () => {
    expect(env).toContain('openRouterApiKey: process.env.OPENROUTER_API_KEY');
    expect(adapter).not.toContain("VITE_OPENROUTER_API_KEY");
    expect(adapter).toContain('authorization: `Bearer ${ENV.openRouterApiKey}`');
  });

  it("uses bounded retries, circuit breaking, cached capability-aware model selection, and server health state", () => {
    expect(adapter).toContain("const RETRY_DELAYS_MS = [350, 1_000]");
    expect(adapter).toContain("const CIRCUIT_FAILURE_THRESHOLD = 2");
    expect(adapter).toContain("const CIRCUIT_COOLDOWN_MS = 45_000");
    expect(adapter).toContain("const MODEL_CACHE_MS = 5 * 60_000");
    expect(adapter).toContain("export async function healthCheckOpenRouter()");
    expect(adapter).toContain("needsVision");
    expect(adapter).toContain("needsStructuredOutput");
  });

  it("keeps Gemini primary, falls back to OpenRouter, then retains Forge as a final compatible route", () => {
    expect(core).toContain('return providers?.length ? providers : ["gemini", "openrouter", "forge"]');
    expect(core).toContain("invokeOpenRouter(invokeParams");
    expect(core).toContain("invokeOpenRouterStream(invokeParams");
    expect(core).toContain("lakayProvider");
  });
});
