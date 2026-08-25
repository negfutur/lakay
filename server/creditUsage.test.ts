import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ consumeCreditForUser: vi.fn(), refundCreditForUser: vi.fn(), getCreditBalanceForUser: vi.fn() }));

import * as db from "./db";
import { preflightAiCredits, refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";

describe("Lakay credit usage gate", () => {
  afterEach(() => vi.clearAllMocks());

  it("preflights the 13-credit welcome balance without debiting before the provider responds", async () => {
    vi.mocked(db.getCreditBalanceForUser).mockResolvedValue({ userId: 7, balance: 13, updatedAt: new Date() } as never);
    await expect(preflightAiCredits(7, "project_plan")).resolves.toMatchObject({ enforced: true, credits: 10, balanceBefore: 13 });
    expect(db.consumeCreditForUser).not.toHaveBeenCalled();
  });

  it("atomically checks and debits credits before a configured AI operation", async () => {
    vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, chargedCredits: 1, balanceAfter: 9 } as never);
    const charge = await requireAiCredits(1, "builder_generate", "test-request");
    expect(charge).toEqual({ enforced: true, charged: true, credits: 1, balanceAfter: 9, idempotencyKey: "builder_generate:test-request" });
    expect(db.consumeCreditForUser).toHaveBeenCalledWith({ userId: 1, credits: 1, operation: "builder_generate", idempotencyKey: "builder_generate:test-request" });
  });

  it("permits a strictly positive fractional balance and consumes the amount available", async () => {
    vi.mocked(db.getCreditBalanceForUser).mockResolvedValue({ userId: 1, balance: 0.2, updatedAt: new Date() } as never);
    vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, chargedCredits: 0.2, balanceAfter: 0 } as never);

    await expect(preflightAiCredits(1, "project_plan")).resolves.toMatchObject({ enforced: true, credits: 0.2, balanceBefore: 0.2 });
    await expect(requireAiCredits(1, "project_plan", "fractional-balance")).resolves.toEqual({ enforced: true, charged: true, credits: 0.2, balanceAfter: 0, idempotencyKey: "project_plan:fractional-balance" });
    expect(db.consumeCreditForUser).toHaveBeenCalledWith({ userId: 1, credits: 10, operation: "project_plan", idempotencyKey: "project_plan:fractional-balance" });
  });

  it("blocks only a zero balance before any provider request", async () => {
    vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: false, insufficient: true, balanceAfter: 0 } as never);
    await expect(requireAiCredits(1, "project_plan", "empty-balance")).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });
});
