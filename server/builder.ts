import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { generateWebsiteFiles } from "./builderGeneration";
import { createBuildProjectContext } from "./projectBuildContext";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { getLlmUserMessage, rethrowLlmError } from "./llmErrors";
import { isSafeBuilderFilePath } from "../shared/builder";
import { createMockWebsiteBuild } from "./mockBuild";
import { createFullStackRunnerManifest, runnerRequiredDiagnostics } from "./runnerContract";
import { assertValidFullStackRunnerManifest, createRunnerStatusEvent } from "../shared/runner";
import { queueRunnerJob, reconcileExpiredRunnerJobs } from "./runnerJobs";
import { transitionOwnedRunnerJob } from "./runnerJobs";
import { uploadMobileSourceAndDispatchGithubEasBuild } from "./githubBuild";
import { protectedProcedure, router } from "./_core/trpc";
import { assertValidStaticBuild, validateStaticBuild } from "./staticBuildValidation";
import { storageGetSignedUrl, storagePut } from "./storage";
import { classifyBuilderChatIntent, createBuilderConversationReply, createLocalBuilderFallbackReply } from "./builderChat";

const projectIdInput = z.object({ projectId: z.string().min(6).max(64) });
const mobileBuildInput = projectIdInput.extend({
  appName: z.string().trim().min(1).max(120),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Utilisez le format de version 1.0.0."),
  bundleId: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,}$/, "Utilisez un identifiant comme com.votreentreprise.votreapp."),
});
const promptImageInput = projectIdInput.extend({ mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), base64: z.string().min(20).max(7_000_000) });
const builderPath = z.string().min(1).max(180).refine(isSafeBuilderFilePath, "Use a safe .html, .css, or .js project file path.");

async function requireProject(userId: number, projectId: string) {
  const project = await db.getProjectForUser(userId, projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

async function getOwnedPromptImageDataUrl(userId: number, projectId: string, key?: string) {
  if (!key) return undefined;
  const prefix = `builder-attachments/${userId}/${projectId}/`;
  if (!key.startsWith(prefix)) throw new TRPCError({ code: "FORBIDDEN", message: "Cette image n’appartient pas à ce projet." });
  const response = await fetch(await storageGetSignedUrl(key));
  if (!response.ok) throw new TRPCError({ code: "NOT_FOUND", message: "L’image jointe est introuvable." });
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
  if (!/^(image\/jpeg|image\/png|image\/webp)$/.test(mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Format d’image non pris en charge." });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 5_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "L’image dépasse la limite de 5 Mo." });
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function getMobileBuildAccessForUser(userId: number, email: string | null | undefined, projectId: string) {
  const isAdministrator = email?.toLowerCase() === "dormesgaetan16@gmail.com";
  const authorization = isAdministrator ? null : await db.getMobileBuildAuthorizationForUser(userId, projectId);
  return {
    isAdministrator,
    authorized: isAdministrator || authorization?.status === "simulated_paid" || authorization?.status === "stripe_paid",
    amountUsdCents: 700,
    mode: isAdministrator ? "administrator" : authorization?.status || "payment_required",
  };
}

async function requireMobileBuildAuthorization(userId: number, email: string | null | undefined, projectId: string) {
  const access = await getMobileBuildAccessForUser(userId, email, projectId);
  if (!access.authorized) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Autorisez la génération mobile de test pour ce projet avant de préparer l’APK ou l’AAB.",
    });
  }
  return access;
}

function safeApkDownload(downloadUrl: string | undefined, filename: string | undefined, expiresAt: string | undefined) {
  if (!downloadUrl || !filename || !expiresAt) return null;
  try {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== "https:") return null;
    if (new Date(expiresAt).getTime() <= Date.now()) return null;
    return { downloadUrl, filename, expiresAt };
  } catch {
    return null;
  }
}

function serializeRunnerJobForOwner(job: Awaited<ReturnType<typeof db.listRunnerJobsForUser>>[number]) {
  const apk = safeApkDownload(job.artifact?.delivery?.apk?.downloadUrl, job.artifact?.delivery?.apk?.filename, job.artifact?.delivery?.apk?.expiresAt);
  return { id: job.id, state: job.state, expiresAt: job.expiresAt, createdAt: job.createdAt, updatedAt: job.updatedAt, apk };
}

function decodePngUpload(dataUrl: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Utilisez une image PNG valide." });
  const bytes = Buffer.from(match[1], "base64");
  const signature = "89504e470d0a1a0a";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex") !== signature) throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier doit être une image PNG valide." });
  if (bytes.length > 4 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Chaque image doit faire 4 Mo maximum." });
  return { bytes, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

export const builderRouter = router({
  get: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    await reconcileExpiredRunnerJobs({ userId: ctx.user.id, projectId: input.projectId });
    const [files, versions, execution, runnerJobs, runnerLogs, mobileBranding] = await Promise.all([
      db.listBuilderFilesForUser(ctx.user.id, input.projectId),
      db.listBuilderVersionsForUser(ctx.user.id, input.projectId),
      db.getRunnerProfileForUser(ctx.user.id, input.projectId),
      db.listRunnerJobsForUser(ctx.user.id, input.projectId),
      db.listRunnerJobLogsForUser(ctx.user.id, input.projectId),
      db.getMobileBrandingForUser(ctx.user.id, input.projectId),
    ]);
    return { files, versions, execution, runnerJobs: (runnerJobs || []).map(serializeRunnerJobForOwner), runnerLogs, mobileBranding, projectContext: createBuildProjectContext(files, versions), validation: validateStaticBuild(files) };
  }),

  getMobileBuildAccess: protectedProcedure.input(projectIdInput).query(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    return getMobileBuildAccessForUser(ctx.user.id, ctx.user.email, input.projectId);
  }),

  authorizeSimulatedMobileBuild: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    if (ctx.user.email?.toLowerCase() === "dormesgaetan16@gmail.com") return { authorized: true, mode: "administrator" as const };
    const authorization = await db.grantSimulatedMobileBuildAuthorizationForUser(ctx.user.id, input.projectId);
    if (!authorization) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
    return { authorized: true, mode: "simulated_paid" as const, authorization };
  }),

  saveMobileBranding: protectedProcedure.input(projectIdInput.extend({ kind: z.enum(["icon", "splash"]), filename: z.string().trim().min(1).max(120), dataUrl: z.string().max(6_000_000) })).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const { bytes, width, height } = decodePngUpload(input.dataUrl);
    const validDimensions = input.kind === "icon" ? width === height && width >= 512 && width <= 2048 : width >= 720 && height >= 720 && width <= 4096 && height <= 4096;
    if (!validDimensions) throw new TRPCError({ code: "BAD_REQUEST", message: input.kind === "icon" ? "L’icône doit être carrée, au format PNG, entre 512 et 2048 px." : "L’écran de démarrage doit être un PNG entre 720 et 4096 px dans chaque dimension." });
    const filename = input.filename.replace(/[^A-Za-z0-9._-]/g, "-").replace(/^[-.]+/, "").slice(0, 120) || `${input.kind}.png`;
    const stored = await storagePut(`mobile-branding/${ctx.user.id}/${input.projectId}/${input.kind}-${filename}`, bytes, "image/png");
    return db.saveMobileBrandingForUser({ userId: ctx.user.id, projectId: input.projectId, kind: input.kind, asset: { key: stored.key, url: stored.url, filename, width, height } });
  }),

  prepareFullStack: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    const project = await requireProject(ctx.user.id, input.projectId);
    const sourceFiles = await db.listBuilderFilesForUser(ctx.user.id, input.projectId);
    const manifest = createFullStackRunnerManifest(project.name, project.description, sourceFiles.map(file => ({ path: file.path, content: file.content })));
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

  prepareMobileBuild: protectedProcedure.input(mobileBuildInput).mutation(async ({ ctx, input }) => {
    const project = await requireProject(ctx.user.id, input.projectId);
    await requireMobileBuildAuthorization(ctx.user.id, ctx.user.email, input.projectId);
    const sourceFiles = await db.listBuilderFilesForUser(ctx.user.id, input.projectId);
    const manifest = createFullStackRunnerManifest(project.name, project.description, sourceFiles.map(file => ({ path: file.path, content: file.content })), { appName: input.appName, version: input.version, bundleId: input.bundleId });
    assertValidFullStackRunnerManifest(manifest);
    const profile = await db.upsertRunnerProfileForUser({
      userId: ctx.user.id,
      projectId: input.projectId,
      mode: "full_stack_runner",
      status: "runner_required",
      manifest,
      diagnostics: runnerRequiredDiagnostics(),
      events: [createRunnerStatusEvent("runner_required", "Mobile build package prepared. Waiting for the secure build connection.")],
    });
    await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: `Mobile package prepared for ${project.name}. The secure Android build step can now continue.` });
    return profile;
  }),

  uploadPromptImage: protectedProcedure.input(promptImageInput).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const bytes = Buffer.from(input.base64, "base64");
    if (!bytes.length || bytes.byteLength > 5_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "Choisissez une image PNG, JPEG ou WebP de 5 Mo maximum." });
    const extension = input.mimeType === "image/jpeg" ? "jpg" : input.mimeType === "image/webp" ? "webp" : "png";
    return storagePut(`builder-attachments/${ctx.user.id}/${input.projectId}/reference.${extension}`, bytes, input.mimeType);
  }),

  dispatchMobileBuild: protectedProcedure.input(projectIdInput.extend({ buildProfile: z.enum(["preview", "production"]).default("preview") })).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    await requireMobileBuildAuthorization(ctx.user.id, ctx.user.email, input.projectId);
    const [profile, mobileBranding] = await Promise.all([
      db.getRunnerProfileForUser(ctx.user.id, input.projectId),
      db.getMobileBrandingForUser(ctx.user.id, input.projectId),
    ]);
    if (!profile?.manifest || profile.mode !== "full_stack_runner") {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Préparez d’abord le package mobile avant de lancer la génération Android." });
    }
    assertValidFullStackRunnerManifest(profile.manifest);
    const queued = await queueRunnerJob({
      userId: ctx.user.id,
      projectId: input.projectId,
      manifest: profile.manifest,
      mobileBranding: mobileBranding ? { ...(mobileBranding.icon ? { icon: mobileBranding.icon } : {}), ...(mobileBranding.splash ? { splash: mobileBranding.splash } : {}) } : undefined,
    });
    if (!queued) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
    try {
      const assigned = await transitionOwnedRunnerJob({ userId: ctx.user.id, projectId: input.projectId, jobId: queued.id, nextState: "runner_assigned", message: "La génération Android a été confiée au service de publication." });
      if (!assigned) throw new Error("The mobile build job could not be assigned.");
      const githubBuild = await uploadMobileSourceAndDispatchGithubEasBuild({ jobId: queued.id, artifact: assigned.artifact, buildProfile: input.buildProfile });
      const artifact = { ...assigned.artifact, githubBuild, easBuild: { platform: "android" as const, status: "queued" as const } };
      await db.updateRunnerJobArtifactForUser({ userId: ctx.user.id, projectId: input.projectId, jobId: queued.id, artifact });
      await transitionOwnedRunnerJob({ userId: ctx.user.id, projectId: input.projectId, jobId: queued.id, nextState: "installing", message: "La source mobile a été transmise à la publication Android." });
      const building = await transitionOwnedRunnerJob({ userId: ctx.user.id, projectId: input.projectId, jobId: queued.id, nextState: "building", message: "La génération Android est en cours. Lakay affichera le téléchargement lorsqu’il sera vérifié." });
      return { id: queued.id, state: building?.state ?? "building", buildProfile: input.buildProfile };
    } catch (error) {
      const current = await db.getRunnerJobForUser(ctx.user.id, input.projectId, queued.id);
      if (current && ["runner_assigned", "installing", "building", "testing"].includes(current.state)) {
        await transitionOwnedRunnerJob({ userId: ctx.user.id, projectId: input.projectId, jobId: queued.id, nextState: "failed", message: "La génération Android n’a pas pu être lancée. Vérifiez la configuration GitHub et Expo." });
      }
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "La génération Android n’a pas pu être lancée. Vérifiez la configuration de publication." });
    }
  }),

  queueRunnerJob: protectedProcedure.input(projectIdInput).mutation(async ({ ctx, input }) => {
    await requireProject(ctx.user.id, input.projectId);
    const [profile, mobileBranding] = await Promise.all([db.getRunnerProfileForUser(ctx.user.id, input.projectId), db.getMobileBrandingForUser(ctx.user.id, input.projectId)]);
    if (!profile?.manifest || profile.mode !== "full_stack_runner") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Prepare the full-stack runner contract before queueing a runner job." });
    assertValidFullStackRunnerManifest(profile.manifest);
    const job = await queueRunnerJob({ userId: ctx.user.id, projectId: input.projectId, manifest: profile.manifest, mobileBranding: mobileBranding ? { ...(mobileBranding.icon ? { icon: mobileBranding.icon } : {}), ...(mobileBranding.splash ? { splash: mobileBranding.splash } : {}) } : undefined });
    if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Project is not available." });
    const events = [...(profile.events || []), createRunnerStatusEvent("build_queued", "Runner job queued. Waiting for an isolated runner to claim the scoped handoff.")].slice(-20);
    await db.upsertRunnerProfileForUser({ userId: ctx.user.id, projectId: input.projectId, mode: "full_stack_runner", status: "build_queued", manifest: profile.manifest, diagnostics: [...runnerRequiredDiagnostics(), "A runner job is queued. No code runs until an isolated runner claims it."], events });
    await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: "Queued a full-stack runner job. It is waiting for a separately provisioned isolated runner; Lakay’s static preview remains available." });
    return job;
  }),

  converse: protectedProcedure
    .input(projectIdInput.extend({ message: z.string().trim().min(1).max(2_000), requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const intent = classifyBuilderChatIntent(input.message);
      if (intent === "build") return { intent };

      const charge = await requireAiCredits(ctx.user.id, "builder_chat", input.requestId);
      let context: { project: Awaited<ReturnType<typeof requireProject>>; files: Awaited<ReturnType<typeof db.listBuilderFilesForUser>> } | null = null;
      try {
        const project = await requireProject(ctx.user.id, input.projectId);
        const [files, history] = await Promise.all([
          db.listBuilderFilesForUser(ctx.user.id, input.projectId),
          db.listProjectMessagesForUser(ctx.user.id, input.projectId),
        ]);
        context = { project, files };
        const reply = await createBuilderConversationReply({ project, files, history, message: input.message });
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "user", content: input.message });
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: reply.content });
        await db.recordAiGenerationUsage({
          userId: ctx.user.id,
          projectId: input.projectId,
          operation: "builder_chat",
          provider: "lakay",
          model: reply.model,
          promptTokens: reply.usage?.prompt_tokens ?? 0,
          candidateTokens: reply.usage?.completion_tokens ?? 0,
          totalTokens: reply.usage?.total_tokens ?? 0,
          creditsCharged: charge.charged ? charge.credits : 0,
          requestId: `builder_chat:${input.requestId}`,
        });
        return { intent, answer: reply.content };
      } catch (error) {
        await refundAiCreditsAfterProviderFailure(ctx.user.id, "builder_chat", charge);
        if (context && getLlmUserMessage(error)) {
          const fallback = createLocalBuilderFallbackReply({ project: context.project, files: context.files, message: input.message });
          await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "user", content: input.message });
          await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: fallback });
          return { intent, answer: fallback, degraded: true };
        }
        return rethrowLlmError(error);
      }
    }),

  generate: protectedProcedure
    .input(projectIdInput.extend({ instruction: z.string().trim().max(4000).optional(), imageKey: z.string().min(10).max(500).optional(), requestId: z.string().uuid(), initialBuild: z.boolean().optional() }))
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
        if (!input.initialBuild) await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "user", content: instruction });
        const projectContext = createBuildProjectContext(existingFiles, versions);
        const referenceImageDataUrl = await getOwnedPromptImageDataUrl(ctx.user.id, input.projectId, input.imageKey);
        const build = await generateWebsiteFiles({ project, instruction, existingFiles, projectContext, referenceImageDataUrl });
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
        await db.createProjectMessage({ projectId: input.projectId, userId: ctx.user.id, role: "assistant", content: input.initialBuild ? `La V1 est prête. ${build.summary}\n\n[[lakay:open-preview]]` : `Build completed: ${build.summary}` });
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
