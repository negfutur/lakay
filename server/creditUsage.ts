import { TRPCError } from "@trpc/server";
import { creditEnforcementEnabled, getCreditUsageCost } from "./creditConfig";
import * as db from "./db";

export async function requireAiCredits(userId: number, operation: string, requestId: string) {
  if (!creditEnforcementEnabled) return { enforced: false } as const;
  const credits = getCreditUsageCost(operation);
  if (!credits) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Credit pricing is not configured for ${operation}.` });
  }
  const result = await db.consumeCreditForUser({
    userId,
    credits,
    operation,
    idempotencyKey: `${operation}:${requestId}`,
  });
  if (result.insufficient) {
    throw new TRPCError({ code: "PAYMENT_REQUIRED", message: "You do not have enough Lakay credits for this AI operation." });
  }
  return { enforced: true, credits, balanceAfter: result.balanceAfter } as const;
}
