import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ consumeCreditForUser: vi.fn(), refundCreditForUser: vi.fn() }));

import * as db from "./db";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";

describe("Lakay credit usage gate", () => {
  afterEach(() => vi.clearAllMocks());

  it("atomically checks and debits credits before a configured AI operation", async () => {
    vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, balanceAfter: 9 } as never);
    const charge = await requireAiCredits(1, "builder_generate", "test-request");
    expect(charge).toEqual({ enforced: true, charged: true, credits: 1, balanceAfter: 9, idempotencyKey: "builder_generate:test-request" });
    expect(db.consumeCreditForUser).toHaveBeenCalledWith({ userId: 1, credits: 1, operation: "builder_generate", idempotencyKey: "builder_generate:test-request" });
  });

  it("blocks a zero or insufficient balance before any provider request", async () => {
    vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: false, insufficient: true, balanceAfter: 0 } as never);
    await expect(requireAiCredits(1, "project_plan", "empty-balance")).rejects.toMatchObject({ code: "PAYMENT_REQUIRED" });
  });
});
