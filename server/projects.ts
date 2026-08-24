import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateProjectPlanWithUsage } from "./projectPlanning";
import { preflightAiCredits, refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { rethrowLlmError } from "./llmErrors";
import { protectedProcedure, router } from "./_core/trpc";

const projectIdInput = z.object({ projectId: z.string().min(6).max(64) });

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listProjectsForUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ description: z.string().trim().min(12).max(6000), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await preflightAiCredits(ctx.user.id, "project_plan");
      let charge: Awaited<ReturnType<typeof requireAiCredits>> = {
        enforced: false,
        charged: false,
        idempotencyKey: `project_plan:${input.requestId}` as `${string}:${string}`,
      };
      try {
        const generated = await generateProjectPlanWithUsage(input.description);
        charge = await requireAiCredits(ctx.user.id, "project_plan", input.requestId);
        const plan = generated.plan;
        const project = await db.createProject({
          userId: ctx.user.id,
          description: input.description,
          plan,
        });
        await db.recordAiGenerationUsage({
          userId: ctx.user.id,
          projectId: project.id,
          operation: "project_plan",
          provider: "gemini",
          model: generated.model,
          promptTokens: generated.usage?.prompt_tokens ?? 0,
          candidateTokens: generated.usage?.completion_tokens ?? 0,
          totalTokens: generated.usage?.total_tokens ?? 0,
          creditsCharged: charge.charged ? charge.credits : 0,
          requestId: `project_plan:${input.requestId}`,
        });
        const originalIdea = input.description.replace(/^Application (web|mobile)\s*:\s*/i, "").trim();
        try {
          await Promise.all([
            db.createProjectMessage({ projectId: project.id, userId: ctx.user.id, role: "user", content: originalIdea }),
            db.createProjectMessage({ projectId: project.id, userId: ctx.user.id, role: "assistant", content: `Votre espace **${project.name}** est configuré. L’application n’est pas encore générée. J’ai compris votre idée : _${originalIdea}_. Décrivez la première version à construire, ou utilisez le bouton **Créer**, et Lakay générera les fichiers avant d’ouvrir l’aperçu.` }),
          ]);
        } catch (messageError) {
          console.error("[Projects] Initial creation conversation could not be persisted:", messageError);
        }
        return project;
      } catch (error) {
        await refundAiCreditsAfterProviderFailure(ctx.user.id, "project_plan", charge);
        return rethrowLlmError(error);
      }
    }),

  get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    const project = await db.getProjectForUser(ctx.user.id, input.projectId);
    if (!project) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    const messages = await db.listProjectMessagesForUser(ctx.user.id, input.projectId);
    return { ...project, messages };
  }),

  update: protectedProcedure
    .input(
      projectIdInput.extend({
        name: z.string().trim().min(2).max(180).optional(),
        description: z.string().trim().min(12).max(6000).optional(),
      }).refine(value => value.name !== undefined || value.description !== undefined, {
        message: "Provide a project name or description to update.",
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { projectId, ...changes } = input;
      const updated = await db.updateProjectForUser(ctx.user.id, projectId, changes);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      }
      return updated;
    }),

  delete: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    const deleted = await db.deleteProjectForUser(ctx.user.id, input.projectId);
    if (!deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
    }
    return { success: true } as const;
  }),
});
