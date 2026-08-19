import { describe, expect, it } from "vitest";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";

describe("Lakay credit usage gate", () => {
  it("does not deduct or block AI work while Stripe credit enforcement is intentionally inactive", async () => {
    const charge = await requireAiCredits(1, "builder_generate", "test-request");
    expect(charge).toEqual({ enforced: false, charged: false, idempotencyKey: "builder_generate:test-request" });
    await expect(refundAiCreditsAfterProviderFailure(1, "builder_generate", charge)).resolves.toEqual({ refunded: false, skipped: true });
  });
});
