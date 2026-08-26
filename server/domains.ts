import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { protectedProcedure, router } from "./_core/trpc";

const projectIdInput = z.object({ projectId: z.string().min(1).max(32) });
const hostnameInput = projectIdInput.extend({ hostname: z.string().trim().min(3).max(253) });

function cleanDomain(value: string) {
  const hostname = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostname)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Indiquez un domaine valide, par exemple monprojet.com." });
  }
  return hostname;
}

function suggestionsFor(projectName: string) {
  const stem = projectName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").replace(/^-+|-+$/g, "").slice(0, 45) || "monprojet";
  return [".com", ".app", ".io", ".co"].map(extension => `${stem}${extension}`);
}

export const domainsRouter = router({
  get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const project = await db.getProjectForUser(ctx.user.id, input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
    const domain = await db.getProjectDomainForUser(ctx.user.id, input.projectId);
    return {
      domain: domain ?? null,
      suggestions: suggestionsFor(project.name),
      partner: { name: "Name.com", checkoutUrl: "https://www.name.com/", affiliateConfigured: Boolean(process.env.NAMECOM_AFFILIATE_URL) },
      dnsReady: false,
    };
  }),
  claim: protectedProcedure.input(hostnameInput).mutation(async ({ ctx, input }) => {
    const project = await db.getProjectForUser(ctx.user.id, input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
    const hostname = cleanDomain(input.hostname);
    return db.upsertProjectDomainForUser({ userId: ctx.user.id, projectId: input.projectId, hostname });
  }),
});
