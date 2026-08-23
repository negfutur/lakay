import { describe, expect, it } from "vitest";
import { canTransitionRunnerJob, sanitizeRunnerLog } from "../shared/runnerJobs";
import { signRunnerHandoffClaim, verifyRunnerHandoffClaim } from "./runnerClaim";

describe("Lakay runner job protocol", () => {
  it("allows only the documented forward runner lifecycle transitions", () => {
    expect(canTransitionRunnerJob("queued", "runner_assigned")).toBe(true);
    expect(canTransitionRunnerJob("runner_assigned", "installing")).toBe(true);
    expect(canTransitionRunnerJob("testing", "preview_ready")).toBe(true);
    expect(canTransitionRunnerJob("queued", "preview_ready")).toBe(false);
    expect(canTransitionRunnerJob("preview_ready", "building")).toBe(false);
    expect(canTransitionRunnerJob("failed", "queued")).toBe(false);
  });

  it("redacts secrets and credentials before runner logs can be persisted", () => {
    const log = sanitizeRunnerLog("authorization: Bearer eyJ.abc api_key=abc123 password=hunter2 DATABASE_URL=mysql://private sk_test_abc");
    expect(log).not.toMatch(/eyJ\.abc|abc123|hunter2|mysql:\/\/private|sk_test_abc/);
    expect(log).toContain("[REDACTED]");
  });

  it("creates signed, expiring handoff claims and rejects tampering or expiry", () => {
    const secret = "runner-test-secret";
    const valid = signRunnerHandoffClaim({ projectId: "project-1", userId: 4, expiresAt: new Date(Date.now() + 60_000).toISOString(), nonce: "nonce" }, secret);
    expect(verifyRunnerHandoffClaim(valid, secret)).toMatchObject({ projectId: "project-1", userId: 4 });
    expect(verifyRunnerHandoffClaim(`${valid}tampered`, secret)).toBeUndefined();
    const expired = signRunnerHandoffClaim({ projectId: "project-1", userId: 4, expiresAt: new Date(Date.now() - 1_000).toISOString(), nonce: "nonce" }, secret);
    expect(verifyRunnerHandoffClaim(expired, secret)).toBeUndefined();
  });
});
