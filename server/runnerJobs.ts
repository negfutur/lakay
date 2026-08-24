import { randomBytes } from "node:crypto";
import type { FullStackRunnerManifest } from "../shared/runner";
import { canTransitionRunnerJob, sanitizeRunnerLog, type RunnerArtifact, type RunnerJobState } from "../shared/runnerJobs";
import * as db from "./db";
import { signRunnerHandoffClaim } from "./runnerClaim";

export async function queueRunnerJob({ userId, projectId, manifest, mobileBranding }: { userId: number; projectId: string; manifest: FullStackRunnerManifest; mobileBranding?: RunnerArtifact["mobileBranding"] }) {
  const artifact: RunnerArtifact = {
    manifest,
    files: manifest.scaffold.files.map(file => ({ path: file.path, content: file.content })),
    policy: { network: "deny_by_default", secrets: "runner_scoped_only", database: "isolated_namespaced" },
    ...(mobileBranding ? { mobileBranding } : {}),
    handoff: { claim: "", expiresAt: "" },
  };
  const handoffToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  artifact.handoff = { claim: signRunnerHandoffClaim({ projectId, userId, expiresAt: expiresAt.toISOString(), nonce: randomBytes(12).toString("base64url") }), expiresAt: expiresAt.toISOString() };
  const job = await db.createRunnerJobForUser({ userId, projectId, artifact, handoffToken, expiresAt });
  if (!job) return undefined;
  await db.createRunnerJobLogForUser({ jobId: job.id, userId, level: "info", message: sanitizeRunnerLog("Runner job queued. Waiting for a separately provisioned isolated runner to claim the scoped handoff.") });
  return job;
}

export async function transitionOwnedRunnerJob({ userId, projectId, jobId, nextState, message }: { userId: number; projectId: string; jobId: string; nextState: RunnerJobState; message: string }) {
  const job = await db.getRunnerJobForUser(userId, projectId, jobId);
  if (!job) return undefined;
  const now = new Date();
  const resolvedState: RunnerJobState = job.expiresAt <= now && job.state !== "preview_ready" ? "expired" : nextState;
  if (resolvedState !== "expired" && !canTransitionRunnerJob(job.state, resolvedState)) throw new Error(`Invalid runner job transition from ${job.state} to ${resolvedState}.`);
  if (resolvedState === "expired" && !["queued", "runner_assigned", "installing", "building", "testing"].includes(job.state)) throw new Error(`Runner job cannot expire from ${job.state}.`);
  const updated = await db.transitionRunnerJobForUser({ userId, projectId, jobId, fromState: job.state, state: resolvedState });
  if (!updated) throw new Error("Runner job state changed before this update could be applied.");
  await db.createRunnerJobLogForUser({ jobId, userId, level: resolvedState === "failed" ? "error" : resolvedState === "preview_ready" ? "success" : resolvedState === "expired" ? "warning" : "info", message: sanitizeRunnerLog(message) });
  return updated;
}

export async function reconcileExpiredRunnerJobs({ userId, projectId }: { userId: number; projectId: string }) {
  const jobs = (await db.listRunnerJobsForUser(userId, projectId)) || [];
  const now = Date.now();
  const active = new Set<RunnerJobState>(["queued", "runner_assigned", "installing", "building", "testing"]);
  const expired = jobs.filter(job => active.has(job.state) && new Date(job.expiresAt).getTime() <= now);
  for (const job of expired) {
    await transitionOwnedRunnerJob({ userId, projectId, jobId: job.id, nextState: "expired", message: "Runner handoff expired before an isolated runner claimed the job." });
  }
  return expired.length;
}
