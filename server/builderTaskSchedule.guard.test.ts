import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("scheduled Builder continuation contract", () => {
  it("persists a task-owned schedule UID and registers an authenticated idempotent callback", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const tasks = readFileSync(resolve(process.cwd(), "server/backgroundTasks.ts"), "utf8");
    const handler = readFileSync(resolve(process.cwd(), "server/builderTaskSchedule.ts"), "utf8");
    const bootstrap = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
    expect(schema).toContain("scheduleCronTaskUid");
    expect(tasks).toContain('path: "/api/scheduled/builder-task-reconcile"');
    expect(tasks).toContain("scheduleBackgroundTaskContinuation");
    expect(handler).toContain("user.isCron || !user.taskUid");
    expect(handler).toContain("getBackgroundTaskByScheduleTaskUid(user.taskUid)");
    expect(bootstrap).toContain("registerBuilderTaskSchedule(app)");
  });
});
