import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getLocalAuthAccountByEmail: vi.fn(),
  createLocalAuthAccount: vi.fn(),
  recordLocalAuthFailure: vi.fn(),
  recordLocalAuthSuccess: vi.fn(),
  resetLocalPasswordFromRecoveryToken: vi.fn(),
}));
vi.mock("./_core/sdk", () => ({ sdk: { createSessionToken: vi.fn() } }));

import { localAuthRouter } from "./localAuth";
import * as db from "./db";

const ctx = { req: {}, res: { cookie: vi.fn() } } as never;

describe("Lakay local recovery routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts recovery requests uniformly while delivery is intentionally not configured", async () => {
    const caller = localAuthRouter.createCaller(ctx);
    await expect(caller.recoveryReadiness()).resolves.toEqual({ deliveryConfigured: false, provider: null });
    await expect(caller.requestPasswordRecovery({ email: "unknown@example.test" })).resolves.toEqual({ accepted: true, deliveryConfigured: false });
    expect(db.getLocalAuthAccountByEmail).not.toHaveBeenCalled();
  });

  it("rotates the password only through a valid single-use token record", async () => {
    const caller = localAuthRouter.createCaller(ctx);
    vi.mocked(db.resetLocalPasswordFromRecoveryToken).mockResolvedValue(true);
    await expect(caller.resetPassword({ token: "a".repeat(32), password: "nouveau-mot-de-passe-solide" })).resolves.toEqual({ success: true });
    expect(db.resetLocalPasswordFromRecoveryToken).toHaveBeenCalledWith("a".repeat(32), expect.stringMatching(/^scrypt\$/));
    vi.mocked(db.resetLocalPasswordFromRecoveryToken).mockResolvedValue(false);
    await expect(caller.resetPassword({ token: "b".repeat(32), password: "nouveau-mot-de-passe-solide" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
