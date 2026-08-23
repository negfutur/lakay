import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  listRunnerJobsForUser: vi.fn(),
  getRunnerJobForUser: vi.fn(),
  transitionRunnerJobForUser: vi.fn(),
  createRunnerJobLogForUser: vi.fn(),
  createRunnerJobForUser: vi.fn(),
}));

import * as db from "./db";
import { reconcileExpiredRunnerJobs, transitionOwnedRunnerJob } from "./runnerJobs";

const expiredJob = { id: "job-expired", projectId: "project-1", userId: 1, state: "queued", expiresAt: new Date(Date.now() - 1_000) };

describe("Lakay runner job service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expires unclaimed active jobs during workspace reconciliation and records a sanitized lifecycle log", async () => {
    vi.mocked(db.listRunnerJobsForUser).mockResolvedValue([expiredJob] as never);
    vi.mocked(db.getRunnerJobForUser).mockResolvedValue(expiredJob as never);
    vi.mocked(db.transitionRunnerJobForUser).mockResolvedValue({ ...expiredJob, state: "expired" } as never);

    await expect(reconcileExpiredRunnerJobs({ userId: 1, projectId: "project-1" })).resolves.toBe(1);

    expect(db.transitionRunnerJobForUser).toHaveBeenCalledWith(expect.objectContaining({ jobId: "job-expired", fromState: "queued", state: "expired" }));
    expect(db.createRunnerJobLogForUser).toHaveBeenCalledWith(expect.objectContaining({ level: "warning", message: expect.stringContaining("expired") }));
  });

  it("rejects invalid lifecycle transitions before writing state or logs", async () => {
    vi.mocked(db.getRunnerJobForUser).mockResolvedValue({ ...expiredJob, expiresAt: new Date(Date.now() + 60_000) } as never);

    await expect(transitionOwnedRunnerJob({ userId: 1, projectId: "project-1", jobId: "job-expired", nextState: "preview_ready", message: "Skip build" })).rejects.toThrow("Invalid runner job transition");

    expect(db.transitionRunnerJobForUser).not.toHaveBeenCalled();
    expect(db.createRunnerJobLogForUser).not.toHaveBeenCalled();
  });
});
