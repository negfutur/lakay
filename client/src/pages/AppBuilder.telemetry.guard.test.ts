import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay runner telemetry workspace", () => {
  it("polls only while a runner job is in an active lifecycle state", () => {
    expect(source).toContain('const telemetryLive = runnerJobs.some(job => ["queued", "runner_assigned", "installing", "building", "testing"].includes(job.state));');
    expect(source).toContain("if (!telemetryLive) return;");
    expect(source).toContain("const telemetryLive = runnerJobs.some");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("}, 3_000);");
  });

  it("refreshes only the protected builder data and exposes a visual live telemetry state", () => {
    expect(source).toContain("utils.builder.get.invalidate({ projectId })");
    expect(source).toContain("Runner status and sanitized logs update every 3 seconds");
    expect(source).toContain("Runner monitoring starts automatically when a job is queued");
  });
});
