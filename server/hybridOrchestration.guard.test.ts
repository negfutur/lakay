import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const env = readFileSync(new URL("./_core/env.ts", import.meta.url), "utf8");
const gemini = readFileSync(new URL("./gemini.ts", import.meta.url), "utf8");
const planning = readFileSync(new URL("./projectPlanning.ts", import.meta.url), "utf8");
const generation = readFileSync(new URL("./builderGeneration.ts", import.meta.url), "utf8");
const credits = readFileSync(new URL("./creditConfig.ts", import.meta.url), "utf8");
const builder = readFileSync(new URL("./builder.ts", import.meta.url), "utf8");

describe("Lakay hybrid Gemini orchestration", () => {
  it("keeps first creation and follow-up model selectors exclusively on the server", () => {
    expect(env).toContain("geminiInitialModel");
    expect(env).toContain("geminiFollowupModel");
    expect(planning).toContain('geminiRoute: "initial"');
    expect(generation).toContain('const route: GeminiRoute = existingFiles?.length ? "followup" : "initial"');
  });

  it("maps native Gemini token usage, retries 429 three times, and records operation usage", () => {
    expect(gemini).toContain("usageMetadata");
    expect(gemini).toContain("const retryDelays = [2_000, 4_000, 8_000]");
    expect(gemini).toContain("error.status === 429 && attempt < retryDelays.length");
    expect(builder).toContain("recordAiGenerationUsage");
    expect(builder).toContain('operation = existingFiles.length ? "builder_generate" : "builder_initial_build"');
  });

  it("uses fixed AI credit costs while accepting Stripe packages only from validated server configuration", () => {
    expect(credits).toContain("project_plan: 10");
    expect(credits).toContain("builder_generate: 1");
    expect(credits).toContain("builder_autofix: 1");
    expect(credits).toContain('process.env.LAKAY_CREDIT_PACKAGES_JSON');
    expect(credits).toContain('startsWith("price_")');
  });
});
