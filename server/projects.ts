import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateProjectPlanWithUsage } from "./projectPlanning";
import { preflightAiCredits, refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { rethrowLlmError } from "./llmErrors";
import { protectedProcedure, router } from "./_core/trpc";
import { storagePut } from "./storage";

const projectIdInput = z.object({ projectId: z.string().min(6).max(64) });
const initialPromptImageInput = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  base64: z.string().min(4).max(7_000_000),
});

type InitialPromptImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  bytes: Buffer;
  dataUrl: string;
  extension: "jpg" | "png" | "webp";
};

function decodeInitialPromptImage(input: z.infer<typeof initialPromptImageInput>): InitialPromptImage {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64) || input.base64.length % 4 !== 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez une image PNG, JPEG ou WebP valide." });
  }
  const bytes = Buffer.from(input.base64, "base64");
  if (!bytes.length || bytes.byteLength > 5_000_000) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez une image PNG, JPEG ou WebP de 5 Mo maximum." });
  }
  const isPng = bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
  const isJpeg = bytes.subarray(0, 3).toString("hex") === "ffd8ff";
  const isWebp = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  const matchesMime = input.mimeType === "image/png" ? isPng : input.mimeType === "image/jpeg" ? isJpeg : isWebp;
  if (!matchesMime) throw new TRPCError({ code: "BAD_REQUEST", message: "Le format déclaré ne correspond pas à l’image jointe." });
  const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/webp" ? "webp" : "png";
  return { mimeType: input.mimeType, bytes, dataUrl: `data:${input.mimeType};base64,${input.base64}`, extension };
}

export const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) => db.listProjectsForUser(ctx.user.id)),

  create: protectedProcedure
    .input(z.object({ description: z.string().trim().min(1).max(6000), target: z.enum(["web", "mobile"]).default("web"), requestId: z.string().uuid(), initialImage: initialPromptImageInput.optional() }))
    .mutation(async ({ ctx, input }) => {
      await preflightAiCredits(ctx.user.id, "project_plan");
      let charge: Awaited<ReturnType<typeof requireAiCredits>> = {
        enforced: false,
        charged: false,
        idempotencyKey: `project_plan:${input.requestId}` as `${string}:${string}`,
      };
      try {
        const initialImage = input.initialImage ? decodeInitialPromptImage(input.initialImage) : undefined;
        const generated = await generateProjectPlanWithUsage(input.description, input.target, initialImage?.dataUrl);
        charge = await requireAiCredits(ctx.user.id, "project_plan", input.requestId);
        const plan = generated.plan;
        const project = await db.createProject({
          userId: ctx.user.id,
          description: input.description,
          target: input.target,
          plan,
        });
        if (initialImage) {
          try {
            const stored = await storagePut(`initial-attachments/${ctx.user.id}/${project.id}/reference.${initialImage.extension}`, initialImage.bytes, initialImage.mimeType);
            await db.saveInitialVisualReferenceForUser({ userId: ctx.user.id, projectId: project.id, key: stored.key, mimeType: initialImage.mimeType });
          } catch (storageError) {
            console.error("[Projects] Initial visual reference could not be retained for the V1 build:", storageError);
          }
        }
        await db.recordAiGenerationUsage({
          userId: ctx.user.id,
          projectId: project.id,
          operation: "project_plan",
          provider: generated.provider,
          model: generated.model,
          promptTokens: generated.usage?.prompt_tokens ?? 0,
          candidateTokens: generated.usage?.completion_tokens ?? 0,
          totalTokens: generated.usage?.total_tokens ?? 0,
          creditsCharged: charge.charged ? charge.credits : 0,
          requestId: `project_plan:${input.requestId}`,
        });
        const originalIdea = input.description.trim();
        const mvpSummary = (plan.tagline || plan.summary || "une première expérience simple, complète et adaptée à votre idée").replace(/\s+/g, " ").trim().slice(0, 180);
        try {
          await db.createProjectMessage({ projectId: project.id, userId: ctx.user.id, role: "user", content: originalIdea });
          await db.createProjectMessage({ projectId: project.id, userId: ctx.user.id, role: "assistant", content: `Très bien — je prépare la V1 de **${project.name}**.\n\n${mvpSummary}.\n\nJe vous montre l’aperçu dès que la première version est prête. [[lakay:open-preview]]\n\nEnsuite, nous pourrons affiner le parcours principal et le style de l’application.` });
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
