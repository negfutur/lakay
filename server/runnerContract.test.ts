import { describe, expect, it } from "vitest";
import { createRunnerScaffold, FULL_STACK_RUNNER_MANIFEST, validateFullStackRunnerManifest } from "../shared/runner";

describe("Lakay full-stack runner contract", () => {
  it("accepts the safe runner manifest and generated unexecuted scaffold", () => {
    const manifest = { ...FULL_STACK_RUNNER_MANIFEST, scaffold: { files: createRunnerScaffold("Runner test") } };
    expect(validateFullStackRunnerManifest(manifest)).toEqual([]);
  });

  it("rejects unsafe scaffold paths, duplicate files, and missing runner isolation", () => {
    const manifest = {
      ...FULL_STACK_RUNNER_MANIFEST,
      isolation: { ...FULL_STACK_RUNNER_MANIFEST.isolation, network: "allow_all" as never },
      scaffold: { files: [
        { ...createRunnerScaffold("Runner test")[0], path: "../secrets.ts" },
        { ...createRunnerScaffold("Runner test")[0], path: "../secrets.ts" },
      ] },
    };
    const issues = validateFullStackRunnerManifest(manifest);
    expect(issues.join(" ")).toMatch(/isolation|Unsafe runner scaffold path|Duplicate runner scaffold path/);
  });
});
