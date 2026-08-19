import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { getCreditPackage } from "./creditConfig";
import { getStripeClient } from "./stripeService";
import { protectedProcedure, router } from "./_core/trpc";

export const billingRouter = router({
  balance: protectedProcedure.query(({ ctx }) => db.getCreditBalanceForUser(ctx.user.id)),

  history: protectedProcedure.query(({ ctx }) => db.listCreditLedgerForUser(ctx.user.id)),

  createCheckout: protectedProcedure
    .input(z.object({ packageId: z.string().trim().min(1).max(80) }))
    .mutation(async ({ ctx, input }) => {
      const creditPackage = getCreditPackage(input.packageId);
      if (!creditPackage) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This credit package is not available." });
      }
      const origin = ctx.req.headers.origin;
      if (!origin) throw new TRPCError({ code: "BAD_REQUEST", message: "A verified application origin is required for checkout." });
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: creditPackage.stripePriceId, quantity: 1 }],
        customer_email: ctx.user.email || undefined,
        client_reference_id: String(ctx.user.id),
        metadata: {
          user_id: String(ctx.user.id),
          package_id: creditPackage.id,
          customer_email: ctx.user.email || "",
          customer_name: ctx.user.name || "",
        },
        allow_promotion_codes: true,
        success_url: `${origin}/dashboard?checkout=success`,
        cancel_url: `${origin}/dashboard?checkout=cancelled`,
      });
      if (!session.url) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe did not return a checkout URL." });
      return { checkoutUrl: session.url };
    }),
});
