import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateWebsiteFiles } from "./builderGeneration";
import { createBuildProjectContext } from "./projectBuildContext";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { rethrowLlmError } from "./llmErrors";
import { isSafeBuilderFilePath } from "../shared/builder";
import { createMockWebsiteBuild } from "./mockBuild";
import { protectedProcedure, router } from "./_core/trpc";
import { assertValidStaticBuild, validateStaticBuild } from "./staticBuildValidation";

const projectIdInput = z.object({ projectId: z.string().min(6).max(64) });
const builderPath = z.string().min(1).max(180).refine(isSafeBuilderFilePath, "Use a safe .html, .css, or .js project file path.");

async function requireProject(userId: number, projectId: string) {
  const project = await db.getProjectForUser(userId, projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

export const builderRouter = router({
  get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const [files, versions] = await Promise.all([
      db.listBuilderFilesForUser(ctx.user.id, input.projectId),
      db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
    ]);
    return { files, versions, projectContext: createBuildProjectContext(files, versions), validation: validateStaticBuild(files) };
  }),

  generate: protectedProcedure
    .input(projectIdInput.extend({ instruction: z.string().trim().max(4000).optional(), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await requireAiCredits(ctx.user.id, "builder_generate", input.requestId);
      try {
        const project = await requireProject(ctx.user.id, input.projectId);
        const [existingFiles, versions] = await Promise.all([
          db.listBuilderFilesForUser(ctx.user.id, input.projectId),
          db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
        ]);
        const instruction = input.instruction?.trim() || "Create the strongest focused first version of this product.";
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "user", content: instruction });
        const projectContext = createBuildProjectContext(existingFiles, versions);
        const build = await generateWebsiteFiles({ project, instruction, existingFiles, projectContext });
        assertValidStaticBuild(build.files);
        const result = await db.replaceBuilderFilesForUser({
          userId: ctx.user.id,
          projectId: input.projectId,
          files: build.files,
          instruction,
          summary: build.summary,
          origin: "generate",
        });
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: `Build completed: ${build.summary}` });
        return result;
      } catch (error) {
        await refundAiCreditsAfterProviderFailure(ctx.user.id, "builder_generate", charge);
        return rethrowLlmError(error);
      }
    }),

  generateMock: protectedProcedure
    .input(projectIdInput.extend({ instruction: z.string().trim().max(4000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const project = await requireProject(ctx.user.id, input.projectId);
      const instruction = input.instruction?.trim() || `Create a polished landing page for ${project.name}`;
      await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "user", content: `[Test mode] ${instruction}` });
      const build = createMockWebsiteBuild({ projectName: project.name, instruction });
      assertValidStaticBuild(build.files);
      const result = await db.replaceBuilderFilesForUser({
        userId: ctx.user.id,
        projectId: input.projectId,
        files: build.files,
        instruction: `[Test mode] ${instruction}`,
        summary: build.summary,
        origin: "generate",
      });
      await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: `Test-mode build completed: ${build.summary}` });
      return result;
    }),

  autoFix: protectedProcedure
    .input(projectIdInput.extend({ issues: z.array(z.string().trim().min(1).max(600)).min(1).max(12), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await requireAiCredits(ctx.user.id, "builder_autofix", input.requestId);
      try {
        const project = await requireProject(ctx.user.id, input.projectId);
        const [existingFiles, versions] = await Promise.all([
          db.listBuilderFilesForUser(ctx.user.id, input.projectId),
          db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
        ]);
        if (existingFiles.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Generate a static build before running auto-fix." });
        }
        const projectContext = createBuildProjectContext(existingFiles, versions);
        const instruction = `Repair this isolated static preview. Address only the reported issues, preserve working behavior, and return a complete valid three-file build. Reported issues:\n${input.issues.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}`;
        const build = await generateWebsiteFiles({ project, instruction, existingFiles, projectContext });
        assertValidStaticBuild(build.files);
        return db.replaceBuilderFilesForUser({
          userId: ctx.user.id,
          projectId: input.projectId,
          files: build.files,
          instruction,
          summary: `Auto-fix: ${build.summary}`,
          origin: "generate",
        });
      } catch (error) {
        await refundAiCreditsAfterProviderFailure(ctx.user.id, "builder_autofix", charge);
        return rethrowLlmError(error);
      }
    }),

  updateFile: protectedProcedure
    .input(projectIdInput.extend({ path: builderPath, content: z.string().min(1).max(60_000) }))
    .mutation(async ({ ctx, input }) => {
      const existingFiles = await db.listBuilderFilesForUser(ctx.user.id, input.projectId);
      if (!existingFiles.some(file => file.path === input.path)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Generated file not found" });
      }
      const candidateFiles = existingFiles.map(file => file.path === input.path ? { ...file, content: input.content } : file);
      try {
        assertValidStaticBuild(candidateFiles);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "This edit cannot run in Lakay's isolated static preview." });
      }
      const updated = await db.updateBuilderFileAndSnapshotForUser(ctx.user.id, input.projectId, input.path, input.content);
      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Generated file not found" });
      return updated;
    }),

  restoreVersion: protectedProcedure
    .input(projectIdInput.extend({ versionId: z.string().min(6).max(64) }))
    .mutation(async ({ ctx, input }) => {
      const version = await db.getBuilderVersionForUser(ctx.user.id, input.projectId, input.versionId);
      if (!version) throw new TRPCError({ code: "NOT_FOUND", message: "Build version not found" });
      return db.replaceBuilderFilesForUser({
        userId: ctx.user.id,
        projectId: input.projectId,
        files: version.files,
        instruction: `Restored build from ${version.createdAt.toISOString()}`,
        summary: version.summary,
        origin: "restore",
      });
    }),
});
