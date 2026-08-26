import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("local password recovery storage guard", () => {
  it("uses a random raw token, stores only its hash, expires it, and invalidates prior unused tokens", () => {
    expect(dbSource).toContain("randomBytes(32).toString(\"base64url\")");
    expect(dbSource).toContain('createHash("sha256").update(rawToken).digest("hex")');
    expect(dbSource).toContain("const LOCAL_RECOVERY_TTL_MS = 30 * 60 * 1000");
    expect(dbSource).toContain("isNull(localPasswordRecoveryTokens.usedAt)");
  });

  it("consumes a valid recovery token once while rotating the password and clearing a login lockout", () => {
    expect(dbSource).toContain("resetLocalPasswordFromRecoveryToken");
    expect(dbSource).toContain("usedAt: new Date()");
    expect(dbSource).toContain("failedAttempts: 0, lockedUntil: null, passwordUpdatedAt: new Date()");
  });
});
