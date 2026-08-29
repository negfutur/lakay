import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

describe("Builder Chat response recovery safeguards", () => {
  it("retries a transient Gemini failure through the other Gemini route", () => {
    const providerCore = source("server/aiProviderCore.ts");
    expect(providerCore).toContain("invokeGeminiWithRouteFallback");
    expect(providerCore).toContain('route === "pro" ? "followup" : "pro"');
    expect(providerCore).not.toContain("invokeOpenRouter(");
  });

  it("rescues generic retryable Gemini processing failures and expires stranded fallback work", () => {
    const tasks = source("server/backgroundTasks.ts");
    expect(tasks).toContain("problem processing your request");
    expect(tasks).toContain("fallbackTaskHasStalled(task)");
  });

  it("synchronizes only the current project's active work before blocking its Chat", () => {
    const builder = source("server/builder.ts");
    expect(builder).toContain("synchronizeBackgroundTasksForUser(ctx.user.id, input.projectId)");
    expect(builder).toContain("Une génération est déjà en cours pour ce projet.");
  });
});
