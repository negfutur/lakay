import type { FullStackRunnerManifest } from "./runner";

export type RunnerJobState = "queued" | "runner_assigned" | "installing" | "building" | "testing" | "preview_ready" | "failed" | "expired" | "cancelled";
export type RunnerLogLevel = "info" | "warning" | "error" | "success";

export type RunnerArtifact = {
  manifest: FullStackRunnerManifest;
  files: Array<{ path: string; content: string }>;
  policy: { network: "deny_by_default"; secrets: "runner_scoped_only"; database: "isolated_namespaced" };
  handoff: { claim: string; expiresAt: string };
};

export const ACTIVE_RUNNER_JOB_STATES: RunnerJobState[] = ["queued", "runner_assigned", "installing", "building", "testing"];

const TRANSITIONS: Record<RunnerJobState, RunnerJobState[]> = {
  queued: ["runner_assigned", "cancelled", "expired"],
  runner_assigned: ["installing", "failed", "cancelled", "expired"],
  installing: ["building", "failed", "cancelled", "expired"],
  building: ["testing", "failed", "cancelled", "expired"],
  testing: ["preview_ready", "failed", "cancelled", "expired"],
  preview_ready: ["expired"],
  failed: [],
  expired: [],
  cancelled: [],
};

export function canTransitionRunnerJob(from: RunnerJobState, to: RunnerJobState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function sanitizeRunnerLog(message: string): string {
  return message
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s]+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|secret|token|password|database_url)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/sk_(?:live|test)_[A-Za-z0-9_]+/g, "[REDACTED]")
    .slice(0, 4_000);
}
