import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Lakay first-prompt fallback planning", () => {
  it("instructs the planning model to choose intelligent defaults for a vague idea rather than request clarification", () => {
    const source = readFileSync(join(process.cwd(), "server/projectPlanning.ts"), "utf8");

    expect(source).toContain("If the idea is short or vague, never ask a clarifying question and never refuse");
    expect(source).toContain("choose sensible defaults");
    expect(source).toContain("a useful V1 can be built immediately");
  });
});
