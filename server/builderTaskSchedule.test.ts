import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: vi.fn() } }));
vi.mock("./db", () => ({ getBackgroundTaskByScheduleTaskUid: vi.fn() }));
vi.mock("./backgroundTasks", () => ({ synchronizeBackgroundTaskForUser: vi.fn() }));

import { sdk } from "./_core/sdk";
import * as db from "./db";
import { synchronizeBackgroundTaskForUser } from "./backgroundTasks";
import { reconcileScheduledBuilderTask } from "./builderTaskSchedule";

function response() {
  const result = { statusCode: 0, body: undefined as unknown };
  return {
    result,
    status: vi.fn((statusCode: number) => { result.statusCode = statusCode; return { json: vi.fn((body: unknown) => { result.body = body; return undefined; }) }; }),
  };
}

describe("scheduled Builder task reconciliation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects callers that are not authenticated platform cron jobs", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: false } as never);
    const res = response();
    await reconcileScheduledBuilderTask({ path: "/api/scheduled/builder-task-reconcile" } as never, res as never);
    expect(res.result.statusCode).toBe(403);
    expect(db.getBackgroundTaskByScheduleTaskUid).not.toHaveBeenCalled();
  });

  it("returns the same cron-only response when platform authentication rejects the request", async () => {
    vi.mocked(sdk.authenticateRequest).mockRejectedValue(new Error("Invalid session"));
    const res = response();
    await reconcileScheduledBuilderTask({ path: "/api/scheduled/builder-task-reconcile" } as never, res as never);
    expect(res.result.statusCode).toBe(403);
    expect(res.result.body).toEqual({ error: "cron-only" });
  });

  it("looks up only by authenticated task UID and reconciles one active persisted task", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "cron-owned-task" } as never);
    vi.mocked(db.getBackgroundTaskByScheduleTaskUid).mockResolvedValue({ id: "builder-task", userId: 7, projectId: "project-7", status: "in_progress" } as never);
    vi.mocked(synchronizeBackgroundTaskForUser).mockResolvedValue({ id: "builder-task", status: "completed" } as never);
    const res = response();

    await reconcileScheduledBuilderTask({ path: "/api/scheduled/builder-task-reconcile", body: { attackerTaskId: "ignored" } } as never, res as never);

    expect(db.getBackgroundTaskByScheduleTaskUid).toHaveBeenCalledWith("cron-owned-task");
    expect(synchronizeBackgroundTaskForUser).toHaveBeenCalledWith(7, "project-7", "builder-task");
    expect(res.result.statusCode).toBe(200);
    expect(res.result.body).toMatchObject({ ok: true, status: "completed" });
  });

  it("does not rerun a terminal task and exposes the callback only under the schedule route", async () => {
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ isCron: true, taskUid: "cron-terminal-task" } as never);
    vi.mocked(db.getBackgroundTaskByScheduleTaskUid).mockResolvedValue({ id: "terminal-task", status: "completed" } as never);
    const res = response();
    await reconcileScheduledBuilderTask({ path: "/api/scheduled/builder-task-reconcile" } as never, res as never);
    expect(synchronizeBackgroundTaskForUser).not.toHaveBeenCalled();
    expect(res.result.body).toMatchObject({ ok: true, skipped: "terminal" });
  });
});
