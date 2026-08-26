import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "server/builderGeneration.ts"), "utf8");

describe("generated application preview safety contract", () => {
  it("forbids generated apps from exposing or imitating an external AI provider", () => {
    expect(source).toContain("Never imitate or call an AI provider from the generated application");
    expect(source).toContain("never reference Gemini/API keys/quotas in user-facing copy");
    expect(source).toContain("never add a provider-error screen");
  });
});
