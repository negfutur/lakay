import { TRPCError } from "@trpc/server";
import { creditEnforcementEnabled, getCreditUsageCost } from "./creditConfig";
import * as db from "./db";

export async function preflightAiCredits(userId: number, operation: string) {
  if (!creditEnforcementEnabled) return { enforced: false, credits: 0 } as const;
  const credits = getCreditUsageCost(operation);
  if (!credits) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Credit pricing is not configured for ${operation}.` });
  }
  const balance = await db.getCreditBalanceForUser(userId);
  if (balance.balance < credits) {
    throw new TRPCError({ code: "PAYMENT_REQUIRED", message: "You do not have enough Lakay credits for this AI operation." });
  }
  return { enforced: true, credits, balanceBefore: balance.balance } as const;
}

export async function requireAiCredits(userId: number, operation: string, requestId: string) {
  if (!creditEnforcementEnabled) return { enforced: false, charged: false, idempotencyKey: `${operation}:${requestId}` } as const;
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
  return { enforced: true, charged: result.consumed === true, credits, balanceAfter: result.balanceAfter, idempotencyKey: `${operation}:${requestId}` } as const;
}

export async function refundAiCreditsAfterProviderFailure(userId: number, operation: string, charge: Awaited<ReturnType<typeof requireAiCredits>>) {
  if (!charge.enforced || !charge.charged) return { refunded: false, skipped: true } as const;
  return db.refundCreditForUser({ userId, credits: charge.credits, operation, idempotencyKey: charge.idempotencyKey });
}
