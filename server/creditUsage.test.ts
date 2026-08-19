import { describe, expect, it } from "vitest";
import { requireAiCredits } from "./creditUsage";

describe("Lakay credit usage gate", () => {
  it("does not deduct or block AI work while Stripe credit enforcement is intentionally inactive", async () => {
    await expect(requireAiCredits(1, "builder_generate")).resolves.toEqual({ enforced: false });
  });
});
