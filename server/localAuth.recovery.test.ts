import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getLocalAuthAccountByEmail: vi.fn(),
  createLocalAuthAccount: vi.fn(),
  recordLocalAuthFailure: vi.fn(),
  recordLocalAuthSuccess: vi.fn(),
  resetLocalPasswordFromRecoveryToken: vi.fn(),
  getLocalAuthAccountForUser: vi.fn(),
  setLocalAuthPasswordForUser: vi.fn(),
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

  it("lets only an authenticated existing user create a local password for their own verified e-mail", async () => {
    const authenticatedCaller = localAuthRouter.createCaller({ ...ctx, user: { id: 7, email: "owner@example.test" } } as never);
    vi.mocked(db.getLocalAuthAccountForUser).mockResolvedValue(undefined);
    vi.mocked(db.setLocalAuthPasswordForUser).mockResolvedValue(true);

    await expect(authenticatedCaller.credentialStatus()).resolves.toEqual({ configured: false, email: "owner@example.test" });
    await expect(authenticatedCaller.setPasswordForCurrentUser({ password: "mot-de-passe-solide" })).resolves.toEqual({ success: true });
    expect(db.setLocalAuthPasswordForUser).toHaveBeenCalledWith({ userId: 7, email: "owner@example.test", passwordHash: expect.stringMatching(/^scrypt\$/) });
  });

  it("keeps an account-provisioning failure user-safe during direct registration", async () => {
    const caller = localAuthRouter.createCaller(ctx);
    vi.mocked(db.getLocalAuthAccountByEmail).mockResolvedValue(undefined);
    vi.mocked(db.createLocalAuthAccount).mockRejectedValue(new Error("Failed query: internal storage detail"));

    await expect(caller.register({ email: "new@example.test", name: "Nouveau compte", password: "mot-de-passe-solide" })).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Votre compte n’a pas pu être créé pour le moment. Réessayez dans un instant.",
    });
  });
});
