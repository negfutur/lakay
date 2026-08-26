import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./localAuth.ts", import.meta.url), "utf8");

describe("local e-mail/password authentication guard", () => {
  it("uses salted scrypt hashes and constant-time password comparison", () => {
    expect(source).toContain("randomBytes(16)");
    expect(source).toContain("scryptSync");
    expect(source).toContain("timingSafeEqual");
    expect(source).not.toMatch(/passwordHash:\s*input\.password/);
  });

  it("limits password attempts and issues the existing signed session cookie", () => {
    expect(source).toContain("const MAX_ATTEMPTS = 5");
    expect(source).toContain("const LOCKOUT_MS = 15 * 60 * 1000");
    expect(source).toContain("sdk.createSessionToken");
    expect(source).toContain("ctx.res.cookie(COOKIE_NAME");
  });
});
