import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { stripeCreditPackagesReady } from "./creditConfig";

function integrationState() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    githubActions: Boolean(process.env.GITHUB_BUILD_TOKEN),
    eas: Boolean(process.env.EAS_BUILD_TOKEN),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
    stripePackages: stripeCreditPackagesReady,
  };
}

export const adminRouter = router({
  overview: adminProcedure.query(async () => ({ ...(await db.getAdminOverview()), integrations: integrationState() })),
  creditPackageDrafts: adminProcedure.query(async () => ({
    checkoutActive: false,
    packages: (await db.listAdminCreditPackageDrafts()).map(item => ({ id: item.id, label: item.label, credits: item.credits, priceConfigured: Boolean(item.stripePriceId), status: item.status, updatedAt: item.updatedAt })),
  })),
  saveCreditPackageDraft: adminProcedure
    .input(z.object({ label: z.string().trim().min(2).max(120), credits: z.number().positive().max(1_000_000), stripePriceId: z.string().trim().regex(/^price_[A-Za-z0-9_]+$/, "Utilisez un Price ID Stripe réel au format price_…").optional() }))
    .mutation(async ({ ctx, input }) => {
      const saved = await db.saveAdminCreditPackageDraft({ createdByUserId: ctx.user.id, ...input });
      return { id: saved?.id, label: saved?.label, credits: saved?.credits, priceConfigured: Boolean(saved?.stripePriceId), status: saved?.status, checkoutActive: false };
    }),
});
