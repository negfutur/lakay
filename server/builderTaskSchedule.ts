import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { synchronizeBackgroundTaskForUser } from "./backgroundTasks";
import { isTerminalBackgroundTaskState, type BackgroundTaskState } from "../shared/backgroundTasks";

export async function reconcileScheduledBuilderTask(req: Request, res: Response) {
  let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    return res.status(403).json({ error: "cron-only" });
  }
  if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
  try {
    const task = await db.getBackgroundTaskByScheduleTaskUid(user.taskUid);
    if (!task) return res.status(200).json({ ok: true, skipped: "orphan" });
    if (isTerminalBackgroundTaskState(task.status as BackgroundTaskState)) return res.status(200).json({ ok: true, skipped: "terminal", status: task.status });
    const updated = await synchronizeBackgroundTaskForUser(task.userId, task.projectId, task.id);
    return res.status(200).json({ ok: true, taskId: task.id, status: updated?.status ?? task.status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scheduled Builder task reconciliation failed.";
    console.error("[Scheduled Builder Task] reconciliation failed", message);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString(), context: { path: req.path } });
  }
}

export function registerBuilderTaskSchedule(app: Express) {
  app.post("/api/scheduled/builder-task-reconcile", reconcileScheduledBuilderTask);
}
