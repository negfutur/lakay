import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateProjectPlan } from "./projectPlanning";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { rethrowLlmError } from "./llmErrors";
import { protectedProcedure, router } from "./_core/trpc";

const projectIdInput = z.object({ projectId: z.string().min(6).max(64) });

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listProjectsForUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ description: z.string().trim().min(12).max(6000), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await requireAiCredits(ctx.user.id, "project_plan", input.requestId);
      try {
        const plan = await generateProjectPlan(input.description);
        return db.createProject({
          userId: ctx.user.id,
          description: input.description,
          plan,
        });
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
