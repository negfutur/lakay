import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateWebsiteFiles } from "./builderGeneration";
import { createBuildProjectContext } from "./projectBuildContext";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { rethrowLlmError } from "./llmErrors";
import { isSafeBuilderFilePath } from "../shared/builder";
import { createMockWebsiteBuild } from "./mockBuild";
import { createFullStackRunnerManifest, runnerRequiredDiagnostics } from "./runnerContract";
import { assertValidFullStackRunnerManifest, createRunnerStatusEvent } from "../shared/runner";
import { queueRunnerJob, reconcileExpiredRunnerJobs } from "./runnerJobs";
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
    await reconcileExpiredRunnerJobs({ userId: ctx.user.id, projectId: input.projectId });
    const [files, versions, execution, runnerJobs, runnerLogs] = await Promise.all([
      db.listBuilderFilesForUser(ctx.user.id, input.projectId),
      db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
      db.getRunnerProfileForUser(ctx.user.id, input.projectId),
      db.listRunnerJobsForUser(ctx.user.id, input.projectId),
      db.listRunnerJobLogsForUser(ctx.user.id, input.projectId),
    ]);
    return { files, versions, execution, runnerJobs, runnerLogs, projectContext: createBuildProjectContext(files, versions), validation: validateStaticBuild(files) };
  }),

  prepareFullStack: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    const project = await requireProject(ctx.user.id, input.projectId);
    const manifest = createFullStackRunnerManifest(project.name);
    assertValidFullStackRunnerManifest(manifest);
    const profile = await db.upsertRunnerProfileForUser({
      userId: ctx.user.id,
      projectId: input.projectId,
      mode: "full_stack_runner",
      status: "runner_required",
      manifest,
      diagnostics: runnerRequiredDiagnostics(),
      events: [createRunnerStatusEvent("runner_required", "Full-stack runner contract prepared. Waiting for an isolated runner connection.")],
    });
    await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: `Prepared full-stack runner contract for ${project.name}. A dedicated isolated runner must be connected before backend, API, database, or package-managed code can execute.` });
    return profile;
  }),

  queueRunnerJob: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const profile = await db.getRunnerProfileForUser(ctx.user.id, input.projectId);
    if (!profile?.manifest || profile.mode !== "full_stack_runner") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Prepare the full-stack runner contract before queueing a runner job." });
    assertValidFullStackRunnerManifest(profile.manifest);
    const job = await queueRunnerJob({ userId: ctx.user.id, projectId: input.projectId, manifest: profile.manifest });
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Project is not available." });
    const events = [...(profile.events || []), createRunnerStatusEvent("build_queued", "Runner job queued. Waiting for an isolated runner to claim the scoped handoff.")].slice(-20);
    await db.upsertRunnerProfileForUser({ userId: ctx.user.id, projectId: input.projectId, mode: "full_stack_runner", status: "build_queued", manifest: profile.manifest, diagnostics: [...runnerRequiredDiagnostics(), "A runner job is queued. No code runs until an isolated runner claims it."], events });
    await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: "Queued a full-stack runner job. It is waiting for a separately provisioned isolated runner; Lakay’s static preview remains available." });
    return job;
  }),

  generate: protectedProcedure
    .input(projectIdInput.extend({ instruction: z.string().trim().max(4000).optional(), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      let charge: Awaited<ReturnType<typeof requireAiCredits>> | { enforced: false; charged: false; idempotencyKey: string } = { enforced: false, charged: false, idempotencyKey: `builder_initial_build:${input.requestId}` };
      let operation = "builder_initial_build";
      try {
        const project = await requireProject(ctx.user.id, input.projectId);
        const [existingFiles, versions] = await Promise.all([
          db.listBuilderFilesForUser(ctx.user.id, input.projectId),
          db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
        ]);
        operation = existingFiles.length ? "builder_generate" : "builder_initial_build";
        if (existingFiles.length) charge = await requireAiCredits(ctx.user.id, operation, input.requestId);
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
        await db.recordAiGenerationUsage({
          userId: ctx.user.id,
          projectId: input.projectId,
          operation,
          provider: "gemini",
          model: build.model,
          promptTokens: build.usage?.prompt_tokens ?? 0,
          candidateTokens: build.usage?.completion_tokens ?? 0,
          totalTokens: build.usage?.total_tokens ?? 0,
          creditsCharged: charge.charged ? charge.credits : 0,
          requestId: `${operation}:${input.requestId}`,
        });
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: `Build completed: ${build.summary}` });
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Builder] Generation failed", { projectId: input.projectId, userId: ctx.user.id, message: message.slice(0, 500) });
        await refundAiCreditsAfterProviderFailure(ctx.user.id, operation, charge as Awaited<ReturnType<typeof requireAiCredits>>);
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

  createPreviewShare: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const share = await db.createPreviewShareForUser(ctx.user.id, input.projectId);
    if (!share) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Generate project files before sharing a preview." });
    return share;
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
        const result = await db.replaceBuilderFilesForUser({
          userId: ctx.user.id,
          projectId: input.projectId,
          files: build.files,
          instruction,
          summary: `Auto-fix: ${build.summary}`,
          origin: "generate",
        });
        await db.recordAiGenerationUsage({
          userId: ctx.user.id,
          projectId: input.projectId,
          operation: "builder_autofix",
          provider: "gemini",
          model: build.model,
          promptTokens: build.usage?.prompt_tokens ?? 0,
          candidateTokens: build.usage?.completion_tokens ?? 0,
          totalTokens: build.usage?.total_tokens ?? 0,
          creditsCharged: charge.charged ? charge.credits : 0,
          requestId: `builder_autofix:${input.requestId}`,
        });
        return result;
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
