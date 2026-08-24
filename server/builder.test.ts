import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  getRunnerProfileForUser: vi.fn(),
  listRunnerJobsForUser: vi.fn(),
  listRunnerJobLogsForUser: vi.fn(),
  getMobileBrandingForUser: vi.fn(),
  saveMobileBrandingForUser: vi.fn(),
  upsertRunnerProfileForUser: vi.fn(),
  createRunnerJobForUser: vi.fn(),
  createRunnerJobLogForUser: vi.fn(),
  replaceBuilderFilesForUser: vi.fn(),
  recordAiGenerationUsage: vi.fn(),
  consumeCreditForUser: vi.fn(),
  refundCreditForUser: vi.fn(),
  updateBuilderFileAndSnapshotForUser: vi.fn(),
  getBuilderVersionForUser: vi.fn(),
  createProjectMessage: vi.fn(),
}));

vi.mock("./builderGeneration", () => ({ generateWebsiteFiles: vi.fn() }));
vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import * as db from "./db";
import { builderRouter } from "./builder";
import { generateWebsiteFiles } from "./builderGeneration";
import { storagePut } from "./storage";
import { LlmProviderQuotaError } from "./_core/llm";

const project = {
  id: "project-builder",
  userId: 1,
  name: "Launchpad",
  description: "A sufficiently detailed concept for a polished launch site.",
  status: "ready",
  generatedPlan: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const files = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><body><main>Launchpad</main></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "body { color: black; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.LakayComponents = {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "console.log('ready')" },
];

function contextFor(userId: number): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "Builder", email: "builder@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, balanceAfter: 20 } as never);
});

afterEach(() => vi.clearAllMocks());

describe("Lakay builder router", () => {
  it("generates a versioned website build only for the authenticated project owner", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(generateWebsiteFiles).mockResolvedValue({ summary: "A launch page", files, model: "gemini-2.5-flash", usage: { prompt_tokens: 120, completion_tokens: 220, total_tokens: 340 } });
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-one", files } as never);

    await expect(caller.generate({ projectId: project.id, instruction: "Make the conversion flow stronger.", requestId: "11111111-1111-4111-8111-111111111111" })).resolves.toMatchObject({ versionId: "version-one" });

    expect(db.getProjectForUser).toHaveBeenCalledWith(1, project.id);
    expect(generateWebsiteFiles).toHaveBeenCalledWith(expect.objectContaining({ project, existingFiles: files }));
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "generate" }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "user", content: "Make the conversion flow stronger." }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "assistant", content: "Build completed: A launch page" }));
    expect(db.recordAiGenerationUsage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, operation: "builder_generate", model: "gemini-2.5-flash", creditsCharged: 1 }));
  });

  it("creates a valid test-only mock build without invoking the external LLM path", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "test-mode-version", files } as never);

    await expect(caller.generateMock({ projectId: project.id, instruction: "Create a blue landing page" })).resolves.toMatchObject({ versionId: "test-mode-version" });

    expect(generateWebsiteFiles).not.toHaveBeenCalled();
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      projectId: project.id,
      origin: "generate",
      instruction: "[Test mode] Create a blue landing page",
      files: expect.arrayContaining([expect.objectContaining({ path: "index.html" }), expect.objectContaining({ path: "app.js" })]),
    }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ role: "assistant", content: expect.stringContaining("Test-mode build completed") }));
  });

  it("rebuilds an owned static project through the AI auto-fix procedure", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(generateWebsiteFiles).mockResolvedValue({ summary: "Repaired the interaction.", files, model: "gemini-2.5-flash", usage: { prompt_tokens: 120, completion_tokens: 220, total_tokens: 340 } });
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-fixed", files } as never);

    await expect(caller.autoFix({ projectId: project.id, issues: ["ReferenceError: activeTab is not defined"], requestId: "22222222-2222-4222-8222-222222222222" })).resolves.toMatchObject({ versionId: "version-fixed" });

    expect(generateWebsiteFiles).toHaveBeenCalledWith(expect.objectContaining({ project, existingFiles: files }));
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ summary: "Auto-fix: Repaired the interaction.", origin: "generate" }));
  });

  it("returns a clear provider-quota state without replacing existing generated files", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(generateWebsiteFiles).mockRejectedValue(new LlmProviderQuotaError("your account has hit a usage exhausted", 9));

    await expect(caller.generate({ projectId: project.id, instruction: "Create a landing page", requestId: "33333333-3333-4333-8333-333333333333" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("external built-in LLM account"),
    });
    expect(db.replaceBuilderFilesForUser).not.toHaveBeenCalled();
  });

  it("returns builder files and versions only after confirming ownership", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);

    await expect(caller.get({ projectId: project.id })).resolves.toMatchObject({ files, versions: [], validation: { valid: true, issues: [] }, projectContext: { recentMemory: [] } });

    expect(db.listBuilderFilesForUser).toHaveBeenCalledWith(1, project.id);
    expect(db.listBuilderVersionsForUser).toHaveBeenCalledWith(1, project.id);
  });

  it("saves direct file edits and restores an owned version into a new saved build", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const version = {
      id: "version-one",
      projectId: project.id,
      userId: 1,
      instruction: "Initial build",
      origin: "generate" as const,
      files,
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
    };
    vi.mocked(db.updateBuilderFileAndSnapshotForUser).mockResolvedValue({ path: "styles.css", content: "body { color: purple; }", versionId: "version-edit" } as never);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(version as never);
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-restored", files } as never);

    await expect(caller.updateFile({ projectId: project.id, path: "styles.css", content: "body { color: purple; }" })).resolves.toMatchObject({ path: "styles.css" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: version.id })).resolves.toMatchObject({ versionId: "version-restored" });

    expect(db.updateBuilderFileAndSnapshotForUser).toHaveBeenCalledWith(1, project.id, "styles.css", "body { color: purple; }");
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(1, project.id, version.id);
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "restore" }));
  });

  it("rejects file edits and version restore when another user has no owned builder record", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.updateBuilderFileAndSnapshotForUser).mockResolvedValue(undefined);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(undefined);

    await expect(caller.updateFile({ projectId: project.id, path: "index.html", content: "<main>Attempt</main>" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: "version-one" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.updateBuilderFileAndSnapshotForUser).not.toHaveBeenCalled();
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(2, project.id, "version-one");
  });

  it("prepares a persisted full-stack runner contract only for the authenticated project owner", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const profile = { projectId: project.id, userId: 1, mode: "full_stack_runner", status: "runner_required", manifest: { runtime: "node20" }, diagnostics: ["Runner required"], updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.upsertRunnerProfileForUser).mockResolvedValue(profile as never);

    await expect(caller.prepareFullStack({ projectId: project.id })).resolves.toMatchObject({ mode: "full_stack_runner", status: "runner_required" });

    expect(db.upsertRunnerProfileForUser).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      projectId: project.id,
      mode: "full_stack_runner",
      status: "runner_required",
      manifest: expect.objectContaining({
        runtime: "node20",
        projectKind: "full_stack_web_app",
        scaffold: expect.objectContaining({ files: expect.arrayContaining([expect.objectContaining({ path: "client/src/main.tsx" }), expect.objectContaining({ path: "server/index.ts" }), expect.objectContaining({ path: "drizzle/schema.ts" })]) }),
      }),
      events: [expect.objectContaining({ state: "runner_required", message: expect.stringContaining("contract prepared") })],
    }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "assistant", content: expect.stringContaining("isolated runner") }));
  });

  it("refuses runner preparation for a project not owned by the authenticated user", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.getProjectForUser).mockResolvedValue(undefined);

    await expect(caller.prepareFullStack({ projectId: project.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.upsertRunnerProfileForUser).not.toHaveBeenCalled();
  });

  it("returns persisted runner diagnostics through the owned builder workspace", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const profile = { projectId: project.id, userId: 1, mode: "full_stack_runner", status: "runner_required", manifest: { runtime: "node20" }, diagnostics: ["No isolated runner is connected."], events: [{ state: "runner_required", message: "Full-stack runner contract prepared.", occurredAt: "2026-08-23T00:00:00.000Z" }], updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue(profile as never);

    const result = await caller.get({ projectId: project.id });

    expect(db.getRunnerProfileForUser).toHaveBeenCalledWith(1, project.id);
    expect(result.execution).toMatchObject({ status: "runner_required", diagnostics: ["No isolated runner is connected."], events: [expect.objectContaining({ state: "runner_required", message: "Full-stack runner contract prepared." })] });
  });

  it("exposes only a valid unexpired APK delivery artifact to the authenticated project owner", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue(undefined);
    vi.mocked(db.listRunnerJobsForUser).mockResolvedValue([{ id: "apk-job", projectId: project.id, userId: 1, state: "preview_ready", artifact: { handoff: { claim: "must-not-leak", expiresAt: "2026-08-24T00:00:00.000Z" }, delivery: { apk: { downloadUrl: "https://downloads.example.test/lakay.apk", filename: "lakay.apk", expiresAt: "2099-01-01T00:00:00.000Z" } } }, expiresAt: new Date("2099-01-01T00:00:00.000Z"), createdAt: new Date(), updatedAt: new Date() }] as never);
    vi.mocked(db.listRunnerJobLogsForUser).mockResolvedValue([] as never);

    const result = await caller.get({ projectId: project.id });

    expect(result.runnerJobs).toEqual([expect.objectContaining({ id: "apk-job", apk: { downloadUrl: "https://downloads.example.test/lakay.apk", filename: "lakay.apk", expiresAt: "2099-01-01T00:00:00.000Z" } })]);
    expect(JSON.stringify(result.runnerJobs)).not.toContain("must-not-leak");
  });

  it("stores a valid owner-scoped PNG mobile icon without exposing storage credentials", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const png = Buffer.alloc(24);
    Buffer.from("89504e470d0a1a0a", "hex").copy(png, 0);
    png.writeUInt32BE(512, 16);
    png.writeUInt32BE(512, 20);
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(storagePut).mockResolvedValue({ key: "mobile-branding/1/project-builder/icon.png", url: "/manus-storage/mobile-branding/1/project-builder/icon.png" });
    vi.mocked(db.saveMobileBrandingForUser).mockResolvedValue({ icon: { key: "mobile-branding/1/project-builder/icon.png", url: "/manus-storage/mobile-branding/1/project-builder/icon.png", filename: "icon.png", width: 512, height: 512 }, splash: null } as never);

    await expect(caller.saveMobileBranding({ projectId: project.id, kind: "icon", filename: "icon.png", dataUrl: `data:image/png;base64,${png.toString("base64")}` })).resolves.toMatchObject({ icon: expect.objectContaining({ filename: "icon.png", width: 512, height: 512 }) });
    expect(storagePut).toHaveBeenCalledWith(expect.stringContaining(`mobile-branding/1/${project.id}/icon-`), expect.any(Buffer), "image/png");
    expect(db.saveMobileBrandingForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, kind: "icon" }));
  });

  it("queues an owned runner job with an expiring scoped artifact after contract preparation", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const manifest = { version: "2026-08", runtime: "node20", projectKind: "full_stack_web_app", framework: "vite_react_express", entrypoints: { client: "client/src/main.tsx", server: "server/index.ts", build: "pnpm build", start: "pnpm start" }, services: { api: true, database: "isolated_namespaced", storage: "scoped" }, isolation: { network: "deny_by_default", secrets: "runner_scoped_only", lifecycle: "ephemeral_job" }, capabilities: { staticPreview: true, runnerRequired: true, autoFixStateMachine: true }, scaffold: { files: [{ path: "package.json", language: "json", purpose: "Scripts", content: "{}" }] } } as never;
    const profile = { projectId: project.id, userId: 1, mode: "full_stack_runner", status: "runner_required", manifest, diagnostics: [], events: [], updatedAt: new Date() };
    const job = { id: "runner-job", projectId: project.id, userId: 1, state: "queued", artifact: {}, expiresAt: new Date(Date.now() + 60_000), createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue(profile as never);
    vi.mocked(db.createRunnerJobForUser).mockResolvedValue(job as never);
    vi.mocked(db.upsertRunnerProfileForUser).mockResolvedValue({ ...profile, status: "build_queued" } as never);

    await expect(caller.queueRunnerJob({ projectId: project.id })).resolves.toMatchObject({ id: "runner-job", state: "queued" });

    expect(db.createRunnerJobForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, expiresAt: expect.any(Date), handoffToken: expect.any(String), artifact: expect.objectContaining({ policy: expect.objectContaining({ network: "deny_by_default" }) }) }));
    expect(db.createRunnerJobLogForUser).toHaveBeenCalledWith(expect.objectContaining({ jobId: "runner-job", userId: 1, level: "info", message: expect.not.stringMatching(/token|secret/i) }));
    expect(db.upsertRunnerProfileForUser).toHaveBeenCalledWith(expect.objectContaining({ status: "build_queued", events: [expect.objectContaining({ state: "build_queued" })] }));
  });

  it("refuses runner job queueing when the user has not prepared an owned runner contract", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue(undefined);

    await expect(caller.queueRunnerJob({ projectId: project.id })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(db.createRunnerJobForUser).not.toHaveBeenCalled();
  });

  it("refuses to queue a runner job for a project that belongs to another user", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.getProjectForUser).mockResolvedValue(undefined);

    await expect(caller.queueRunnerJob({ projectId: project.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(db.getRunnerProfileForUser).not.toHaveBeenCalled();
    expect(db.createRunnerJobForUser).not.toHaveBeenCalled();
  });
});
