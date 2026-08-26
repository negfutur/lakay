import { adminProcedure, router } from "./_core/trpc";
import * as db from "./db";

function integrationState() {
  return {
    gemini: Boolean(process.env.GEMINI_API_KEY),
    githubActions: Boolean(process.env.GITHUB_BUILD_TOKEN),
    eas: Boolean(process.env.EAS_BUILD_TOKEN),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  };
}

export const adminRouter = router({
  overview: adminProcedure.query(async () => ({ ...(await db.getAdminOverview()), integrations: integrationState() })),
});
