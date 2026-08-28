import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listProjectMessagesForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  getRunnerProfileForUser: vi.fn(),
  getRunnerJobForUser: vi.fn(),
  listRunnerJobsForUser: vi.fn(),
  listBackgroundTasksForUser: vi.fn(),
  getActiveBackgroundTaskForUser: vi.fn(),
  acquireAiRequestLeaseForUser: vi.fn(),
  releaseAiRequestLeaseForUser: vi.fn(),
  getBackgroundTaskForUser: vi.fn(),
  transitionRunnerJobForUser: vi.fn(),
  listRunnerJobLogsForUser: vi.fn(),
  getMobileBrandingForUser: vi.fn(),
  getMobileBuildAuthorizationForUser: vi.fn(),
  grantSimulatedMobileBuildAuthorizationForUser: vi.fn(),
  updateRunnerJobArtifactForUser: vi.fn(),
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
  getInitialVisualReferenceForUser: vi.fn(),
  getPendingProjectAgentActionForUser: vi.fn(),
  createProjectAgentActionForUser: vi.fn(),
  updateProjectAgentActionStatusForUser: vi.fn(),
  listProjectAgentActionsForUser: vi.fn(),
}));

vi.mock("./builderGeneration", () => ({ generateWebsiteFiles: vi.fn() }));
vi.mock("./builderChat", () => ({ classifyBuilderChatIntent: vi.fn(), createBuilderConversationReply: vi.fn(), createContinuationBuilderAction: vi.fn(), createImmediateBuilderAcknowledgement: vi.fn(), createImmediateDiagnosticReply: vi.fn(() => null), createImmediateProjectProgressReply: vi.fn(), createImmediateVersionClarificationReply: vi.fn(), createLocalBuilderFallbackReply: vi.fn(), isContinuationRequest: vi.fn() }));
vi.mock("./storage", () => ({ storageGetSignedUrl: vi.fn(), storagePut: vi.fn() }));
vi.mock("./githubBuild", () => ({ uploadMobileSourceAndDispatchGithubEasBuild: vi.fn() }));
vi.mock("./easBuild", () => ({ getAndroidBuildReadiness: vi.fn() }));
vi.mock("./backgroundTasks", () => ({ MAX_BACKGROUND_TASK_RETRIES: 2, cancelBackgroundTaskForUser: vi.fn(), scheduleBackgroundTaskContinuation: vi.fn(task => task), submitBackgroundBuilderTask: vi.fn(), synchronizeBackgroundTaskForUser: vi.fn(), synchronizeBackgroundTasksForUser: vi.fn() }));
vi.mock("./projectAgent", () => ({ assessProjectAgentRequest: vi.fn() }));

import * as db from "./db";
import { builderRouter } from "./builder";
import { generateWebsiteFiles } from "./builderGeneration";
import { classifyBuilderChatIntent, createBuilderConversationReply, createContinuationBuilderAction, createImmediateBuilderAcknowledgement, createImmediateProjectProgressReply, createImmediateVersionClarificationReply, createLocalBuilderFallbackReply, isContinuationRequest } from "./builderChat";
import { storagePut } from "./storage";
import { uploadMobileSourceAndDispatchGithubEasBuild } from "./githubBuild";
import { getAndroidBuildReadiness } from "./easBuild";
import { scheduleBackgroundTaskContinuation, submitBackgroundBuilderTask, synchronizeBackgroundTasksForUser } from "./backgroundTasks";
import { assessProjectAgentRequest } from "./projectAgent";
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

function contextFor(userId: number, email = "builder@example.com"): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "Builder", email, loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, chargedCredits: 1, balanceAfter: 20 } as never);
  vi.mocked(createImmediateVersionClarificationReply).mockReturnValue(null);
});

afterEach(() => vi.clearAllMocks());

beforeEach(() => {
  vi.mocked(db.getPendingProjectAgentActionForUser).mockResolvedValue(undefined);
  vi.mocked(db.listProjectAgentActionsForUser).mockResolvedValue([]);
  vi.mocked(db.getActiveBackgroundTaskForUser).mockResolvedValue(undefined);
  vi.mocked(db.acquireAiRequestLeaseForUser).mockResolvedValue(true);
  vi.mocked(db.releaseAiRequestLeaseForUser).mockResolvedValue(undefined);
  vi.mocked(synchronizeBackgroundTasksForUser).mockResolvedValue([] as never);
  vi.mocked(assessProjectAgentRequest).mockReturnValue({ kind: "conversation", impact: "safe" });
  vi.mocked(getAndroidBuildReadiness).mockResolvedValue({ ready: true, expoToken: "verified", githubBridge: "verified", githubExpoSecret: "verified", webhook: "configured" });
});

describe("Lakay builder router", () => {
  it("grants unlimited mobile build access to the configured administrator without recording a payment", async () => {
    const caller = builderRouter.createCaller(contextFor(1, "dormesgaetan16@gmail.com"));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);

    await expect(caller.getMobileBuildAccess({ projectId: project.id })).resolves.toEqual({
      isAdministrator: true,
      authorized: true,
      amountUsdCents: 700,
      mode: "administrator",
    });
    await expect(caller.authorizeSimulatedMobileBuild({ projectId: project.id })).resolves.toEqual({ authorized: true, mode: "administrator" });

    expect(db.getMobileBuildAuthorizationForUser).not.toHaveBeenCalled();
    expect(db.grantSimulatedMobileBuildAuthorizationForUser).not.toHaveBeenCalled();
  });

  it("requires and records a per-project simulated authorization for non-administrator mobile builds", async () => {
    const caller = builderRouter.createCaller(contextFor(2, "member@example.com"));
    const authorization = { id: "mobile-auth", userId: 2, projectId: project.id, status: "simulated_paid", amountUsdCents: 700, providerReference: "simulated_mobile_build:2:project-builder", createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue({ ...project, userId: 2 } as never);
    vi.mocked(db.getMobileBuildAuthorizationForUser).mockResolvedValue(undefined);
    vi.mocked(db.grantSimulatedMobileBuildAuthorizationForUser).mockResolvedValue(authorization as never);

    await expect(caller.getMobileBuildAccess({ projectId: project.id })).resolves.toEqual({
      isAdministrator: false,
      authorized: false,
      amountUsdCents: 700,
      mode: "payment_required",
    });
    await expect(caller.authorizeSimulatedMobileBuild({ projectId: project.id })).resolves.toMatchObject({ authorized: true, mode: "simulated_paid", authorization });

    expect(db.grantSimulatedMobileBuildAuthorizationForUser).toHaveBeenCalledWith(2, project.id);
  });

  it("refuses mobile build preparation until the project has an administrator or paid authorization", async () => {
    const caller = builderRouter.createCaller(contextFor(2, "member@example.com"));
    vi.mocked(db.getProjectForUser).mockResolvedValue({ ...project, userId: 2 } as never);
    vi.mocked(db.getMobileBuildAuthorizationForUser).mockResolvedValue(undefined);

    await expect(caller.prepareMobileBuild({ projectId: project.id, appName: "Project mobile", version: "1.0.0", bundleId: "com.lakay.project" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Autorisez la génération mobile de test"),
    });
    expect(db.upsertRunnerProfileForUser).not.toHaveBeenCalled();
  });

  it("dispatches an authorized mobile build through the server-only GitHub bridge after package preparation", async () => {
    const caller = builderRouter.createCaller(contextFor(1, "dormesgaetan16@gmail.com"));
    const manifest = { version: "2026-08", runtime: "node20", projectKind: "full_stack_web_app", framework: "vite_react_express", entrypoints: { client: "client/src/main.tsx", server: "server/index.ts", build: "pnpm build", start: "pnpm start" }, services: { api: true, database: "isolated_namespaced", storage: "scoped" }, isolation: { network: "deny_by_default", secrets: "runner_scoped_only", lifecycle: "ephemeral_job" }, capabilities: { staticPreview: true, runnerRequired: true, autoFixStateMachine: true }, scaffold: { files: [{ path: "mobile/package.json", language: "json", purpose: "mobile", content: "{}" }, { path: "mobile/app.json", language: "json", purpose: "mobile", content: "{}" }, { path: "mobile/eas.json", language: "json", purpose: "mobile", content: "{}" }, { path: "mobile/App.tsx", language: "tsx", purpose: "mobile", content: "export default function App() { return null; }" }] } } as never;
    const profile = { projectId: project.id, userId: 1, mode: "full_stack_runner", status: "runner_required", manifest, diagnostics: [], events: [], updatedAt: new Date() };
    const job = { id: "mobile-job", projectId: project.id, userId: 1, state: "queued", artifact: { manifest, files: manifest.scaffold.files, policy: { network: "deny_by_default", secrets: "runner_scoped_only", database: "isolated_namespaced" }, handoff: { claim: "signed", expiresAt: "2099-01-01T00:00:00.000Z" } }, expiresAt: new Date("2099-01-01T00:00:00.000Z"), createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue(profile as never);
    vi.mocked(db.createRunnerJobForUser).mockResolvedValue(job as never);
    vi.mocked(db.getRunnerJobForUser)
      .mockResolvedValueOnce(job as never)
      .mockResolvedValueOnce({ ...job, state: "runner_assigned" } as never)
      .mockResolvedValueOnce({ ...job, state: "installing" } as never);
    vi.mocked(db.transitionRunnerJobForUser).mockImplementation(async ({ state }) => ({ ...job, state }) as never);
    vi.mocked(uploadMobileSourceAndDispatchGithubEasBuild).mockResolvedValue({ repository: "negfutur/lakay", branch: "lakay/mobile-build-mobile-job", workflow: "eas-build.yml", dispatchedAt: "2026-08-25T00:00:00.000Z" });

    await expect(caller.dispatchMobileBuild({ projectId: project.id, buildProfile: "preview" })).resolves.toMatchObject({ id: "mobile-job", state: "building", buildProfile: "preview" });
    expect(uploadMobileSourceAndDispatchGithubEasBuild).toHaveBeenCalledWith(expect.objectContaining({ jobId: "mobile-job", buildProfile: "preview" }));
    expect(db.updateRunnerJobArtifactForUser).toHaveBeenCalledWith(expect.objectContaining({ jobId: "mobile-job", artifact: expect.objectContaining({ githubBuild: expect.objectContaining({ branch: "lakay/mobile-build-mobile-job" }), easBuild: { platform: "android", status: "queued" } }) }));
  });

  it("does not queue an Android build while verified delivery prerequisites are incomplete", async () => {
    const caller = builderRouter.createCaller(contextFor(1, "dormesgaetan16@gmail.com"));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(getAndroidBuildReadiness).mockResolvedValue({ ready: false, expoToken: "verified", githubBridge: "verified", githubExpoSecret: "verified", webhook: "unavailable" });

    await expect(caller.dispatchMobileBuild({ projectId: project.id, buildProfile: "preview" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Aucun build n’a été lancé"),
    });
    expect(db.createRunnerJobForUser).not.toHaveBeenCalled();
  });

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

  it("answers a Builder question without replacing generated application files", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([{ role: "user", content: "Je veux un lancement simple." }] as never);
    vi.mocked(createBuilderConversationReply).mockResolvedValue({ content: "La capture d’idée est prête. La prochaine étape utile est la recherche.", model: "gemini-flash-latest", usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 } });

    await expect(caller.converse({ projectId: project.id, message: "Quelle est la cible principale du projet ?", requestId: "66666666-6666-4666-8666-666666666666" })).resolves.toEqual({ intent: "conversation", answer: "La capture d’idée est prête. La prochaine étape utile est la recherche." });

    expect(db.createProjectMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ role: "user", content: "Quelle est la cible principale du projet ?" }));
    expect(db.createProjectMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: "assistant", content: expect.stringContaining("capture d’idée") }));
    expect(db.replaceBuilderFilesForUser).not.toHaveBeenCalled();
  });

  it("rejects a new provider request while the same account has a durable generation in progress", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(synchronizeBackgroundTasksForUser).mockResolvedValue([{ id: "active-task", userId: 1, projectId: project.id, status: "in_progress" }] as never);

    await expect(caller.converse({ projectId: project.id, message: "Analyse le parcours", requestId: "61616161-6161-4616-8616-616161616161" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringContaining("déjà en cours"),
    });
    expect(createBuilderConversationReply).not.toHaveBeenCalled();
  });

  it("does not let an active task in another project silence this project's Chat reply", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(synchronizeBackgroundTasksForUser).mockResolvedValue([] as never);
    vi.mocked(db.getActiveBackgroundTaskForUser).mockResolvedValue({ id: "other-project-active", projectId: "other-project", userId: 1, status: "in_progress" } as never);
    vi.mocked(createBuilderConversationReply).mockResolvedValue({ content: "Le parcours principal est prêt à être vérifié.", model: "minimax-m3-free", usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 } });

    await expect(caller.converse({ projectId: project.id, message: "Quel est le prochain test ?", requestId: "62626262-6262-4626-8626-626262626262" })).resolves.toMatchObject({ intent: "conversation", answer: expect.stringContaining("parcours principal") });
    expect(synchronizeBackgroundTasksForUser).toHaveBeenCalledWith(1, project.id);
    expect(db.getActiveBackgroundTaskForUser).not.toHaveBeenCalled();
  });

  it("sends a project-status question to the general copilot with saved context instead of forcing a canned diagnostic", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([{ role: "assistant", content: "La recherche rapide est la prochaine priorité." }] as never);
    vi.mocked(createBuilderConversationReply).mockResolvedValue({ content: "Il reste à tester la recherche rapide, puis à corriger le premier blocage observé dans l’aperçu.", model: "gemini-flash-latest", usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 } });

    await expect(caller.converse({ projectId: project.id, message: "Il me reste quoi à faire ?", requestId: "67676767-6767-4676-8676-676767676767" })).resolves.toEqual({ intent: "conversation", answer: "Il reste à tester la recherche rapide, puis à corriger le premier blocage observé dans l’aperçu." });

    expect(createBuilderConversationReply).toHaveBeenCalledWith(expect.objectContaining({ history: expect.any(Array), versions: [] }));
    expect(db.consumeCreditForUser).toHaveBeenCalled();
    expect(db.createProjectMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: "assistant", content: expect.stringContaining("recherche rapide") }));
  });

  it("keeps a non-action acknowledgement in the general project-aware conversation path", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(createBuilderConversationReply).mockResolvedValue({ content: "Bien reçu. Je garde cette direction ; dites-moi la partie que vous souhaitez analyser ou modifier ensuite.", model: "gemini-flash-latest", usage: { prompt_tokens: 80, completion_tokens: 24, total_tokens: 104 } });

    await expect(caller.converse({ projectId: project.id, message: "Merci", requestId: "68686868-6868-4686-8686-686868686868" })).resolves.toMatchObject({ intent: "conversation", answer: expect.stringContaining("Bien reçu") });

    expect(createBuilderConversationReply).toHaveBeenCalled();
    expect(db.consumeCreditForUser).toHaveBeenCalled();
    expect(db.createProjectMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: "assistant", content: expect.stringContaining("Bien reçu") }));
  });

  it("turns an imperative continuation into a visible selected build instruction", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(assessProjectAgentRequest).mockReturnValue({ kind: "modify", impact: "moderate", instruction: "Ajoute une recherche rapide visible dans le parcours principal." });

    await expect(caller.converse({ projectId: project.id, message: "Ajoute une recherche", requestId: "69696969-6969-4696-8696-696969696969" })).resolves.toMatchObject({ intent: "build", instruction: expect.stringContaining("recherche rapide") });

    expect(db.consumeCreditForUser).not.toHaveBeenCalled();
    expect(db.createProjectMessage).not.toHaveBeenCalled();
  });

  it("persists one high-impact action and waits for explicit confirmation without generating or publishing automatically", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(assessProjectAgentRequest).mockReturnValue({ kind: "confirm", impact: "high", instruction: "Publie l’application maintenant.", summary: "Publie l’application maintenant.", answer: "Confirmation requise." });
    vi.mocked(db.createProjectAgentActionForUser).mockResolvedValue({ id: "agent-action-1" } as never);

    await expect(caller.converse({ projectId: project.id, message: "Publie l’application maintenant", requestId: "79898989-7989-4789-8789-798989898989" })).resolves.toMatchObject({ intent: "conversation", action: "confirm", actionId: "agent-action-1" });

    expect(db.createProjectAgentActionForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, impact: "high", type: "confirm" }));
    expect(db.replaceBuilderFilesForUser).not.toHaveBeenCalled();
  });

  it("records an approved high-impact action without turning it into an unsafe code-generation request", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.getPendingProjectAgentActionForUser).mockResolvedValue({ id: "agent-action-1", instruction: "Publie l’application maintenant.", summary: "Publie l’application maintenant." } as never);
    vi.mocked(assessProjectAgentRequest).mockReturnValue({ kind: "confirmed", impact: "high", actionId: "agent-action-1", instruction: "Publie l’application maintenant.", answer: "Confirmation enregistrée." });

    await expect(caller.converse({ projectId: project.id, message: "Confirmer", requestId: "88888888-8888-4888-8888-888888888888" })).resolves.toMatchObject({ intent: "conversation", action: "confirmed", confirmedActionId: "agent-action-1" });

    expect(db.updateProjectAgentActionStatusForUser).toHaveBeenCalledWith(expect.objectContaining({ actionId: "agent-action-1", status: "confirmed" }));
    expect(db.replaceBuilderFilesForUser).not.toHaveBeenCalled();
  });

  it("persists a local conversational fallback without changing files when the provider is unavailable", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(createBuilderConversationReply).mockRejectedValue(new LlmProviderQuotaError("provider temporarily unavailable", 1));
    vi.mocked(createLocalBuilderFallbackReply).mockReturnValue("La réponse détaillée est momentanément indisponible, mais votre application n’a pas été modifiée.");

    await expect(caller.converse({ projectId: project.id, message: "Il reste quoi à faire ?", requestId: "77777777-7777-4777-8777-777777777777" })).resolves.toMatchObject({ intent: "conversation", degraded: true, answer: expect.stringContaining("n’a pas été modifiée") });

    expect(db.refundCreditForUser).toHaveBeenCalled();
    expect(db.replaceBuilderFilesForUser).not.toHaveBeenCalled();
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

  it("retries an owned failed task from its saved prompt and visual reference without trusting the browser", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const failedTask = {
      id: "failed-image-task",
      projectId: project.id,
      userId: 1,
      status: "failed",
      progress: "La tâche n’a pas pu être terminée.",
      instruction: "Construis le jeu d’aventure à partir de la référence jointe.",
      visualReferenceKey: `initial-attachments/1/${project.id}/reference.png`,
      visualReferenceMimeType: "image/png",
      creditOperation: "builder_initial_build",
      creditsCharged: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getBackgroundTaskForUser).mockResolvedValue(failedTask as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([{ role: "user", content: "Je veux un jeu 2D." }] as never);
    vi.mocked(db.listBackgroundTasksForUser).mockResolvedValue([failedTask] as never);
    vi.mocked(db.getInitialVisualReferenceForUser).mockResolvedValue({ key: `initial-attachments/1/${project.id}/reference.png`, mimeType: "image/png" } as never);
    vi.mocked(submitBackgroundBuilderTask).mockResolvedValue({ ...failedTask, id: "retry-image-task", status: "queued", progress: "Tâche en file d’attente…" } as never);

    await expect(caller.retryBackgroundGenerate({ projectId: project.id, taskId: failedTask.id, requestId: "44444444-4444-4444-8444-444444444444" })).resolves.toMatchObject({ id: "retry-image-task", status: "queued" });

    expect(submitBackgroundBuilderTask).toHaveBeenCalledWith(expect.objectContaining({
      userId: 1,
      project,
      instruction: failedTask.instruction,
      retryOfTaskId: failedTask.id,
      visualReference: { key: failedTask.visualReferenceKey, mimeType: "image/png" },
    }));
  });

  it("keeps an accepted background task available when continuation scheduling is temporarily unavailable", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const acceptedTask = { id: "accepted-background-task", projectId: project.id, userId: 1, status: "queued", progress: "Tâche en file d’attente…", providerInteractionId: "gemini-interaction", createdAt: new Date(), updatedAt: new Date() };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(submitBackgroundBuilderTask).mockResolvedValue(acceptedTask as never);
    vi.mocked(scheduleBackgroundTaskContinuation).mockRejectedValue(new Error("Platform schedule unavailable"));

    await expect(caller.startBackgroundGenerate({ projectId: project.id, instruction: "Construis la première version.", requestId: "98989898-9898-4989-8989-989898989898" })).resolves.toMatchObject({ id: "accepted-background-task", status: "queued" });
    expect(submitBackgroundBuilderTask).toHaveBeenCalled();
  });

  it("backfills the retained project image when retrying a legacy failed first build without task image metadata", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const legacyTask = {
      id: "legacy-failed-task",
      projectId: project.id,
      userId: 1,
      status: "failed",
      progress: "La tâche n’a pas pu être terminée.",
      instruction: "Construis le jeu d’aventure demandé.",
      visualReferenceKey: null,
      visualReferenceMimeType: null,
      creditOperation: "builder_initial_build",
      creditsCharged: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getBackgroundTaskForUser).mockResolvedValue(legacyTask as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBackgroundTasksForUser).mockResolvedValue([legacyTask] as never);
    vi.mocked(db.getInitialVisualReferenceForUser).mockResolvedValue({ key: `initial-attachments/1/${project.id}/reference.jpg`, mimeType: "image/jpeg" } as never);
    vi.mocked(submitBackgroundBuilderTask).mockResolvedValue({ ...legacyTask, id: "legacy-retry-task", status: "queued", progress: "Tâche en file d’attente…" } as never);

    await expect(caller.retryBackgroundGenerate({ projectId: project.id, taskId: legacyTask.id, requestId: "56565656-5656-4565-8565-565656565656" })).resolves.toMatchObject({ id: "legacy-retry-task", status: "queued" });

    expect(submitBackgroundBuilderTask).toHaveBeenCalledWith(expect.objectContaining({
      retryOfTaskId: legacyTask.id,
      visualReference: { key: `initial-attachments/1/${project.id}/reference.jpg`, mimeType: "image/jpeg" },
    }));
  });

  it("refuses a retry when the failed task is not owned by the active user", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.getProjectForUser).mockResolvedValue({ ...project, userId: 2 } as never);
    vi.mocked(db.getBackgroundTaskForUser).mockResolvedValue(undefined);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBackgroundTasksForUser).mockResolvedValue([] as never);

    await expect(caller.retryBackgroundGenerate({ projectId: project.id, taskId: "failed-image-task", requestId: "55555555-5555-4555-8555-555555555555" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(submitBackgroundBuilderTask).not.toHaveBeenCalled();
  });

  it("uses one OpenRouter rescue after two failed Gemini retries, then stops repeated retries", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const root = { id: "root-failed-task", projectId: project.id, userId: 1, status: "failed", instruction: "Répare le parcours.", retryOfTaskId: null };
    const retryOne = { id: "retry-one-task", projectId: project.id, userId: 1, status: "failed", instruction: root.instruction, retryOfTaskId: root.id };
    const retryTwo = { id: "retry-two-task", projectId: project.id, userId: 1, status: "failed", instruction: root.instruction, retryOfTaskId: retryOne.id };
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getBackgroundTaskForUser).mockResolvedValue(retryTwo as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBackgroundTasksForUser).mockResolvedValue([root, retryOne, retryTwo] as never);
    vi.mocked(db.getInitialVisualReferenceForUser).mockResolvedValue(undefined);
    vi.mocked(submitBackgroundBuilderTask).mockResolvedValue({ ...retryTwo, id: "openrouter-rescue-task", status: "completed", progress: "Modification terminée et résultat enregistré.", providerInteractionId: "openrouter-rescue:openrouter-rescue-task", providerModel: "openrouter-fallback" } as never);

    await expect(caller.retryBackgroundGenerate({ projectId: project.id, taskId: retryTwo.id, requestId: "57575757-5757-4575-8575-575757575757" })).resolves.toMatchObject({ id: "openrouter-rescue-task" });
    expect(submitBackgroundBuilderTask).toHaveBeenLastCalledWith(expect.objectContaining({ providerPreference: "openrouter_rescue" }));
    vi.mocked(db.listBackgroundTasksForUser).mockResolvedValue([root, retryOne, retryTwo, { ...retryTwo, id: "openrouter-rescue-task", retryOfTaskId: retryTwo.id, providerInteractionId: "openrouter-rescue:openrouter-rescue-task", providerModel: "openrouter-fallback" }] as never);

    await expect(caller.retryBackgroundGenerate({ projectId: project.id, taskId: retryTwo.id, requestId: "67676767-6767-4676-8676-676767676767" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: expect.stringContaining("déjà été relancée deux fois") });
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
        projectKind: "web_application",
        scaffold: expect.objectContaining({ files: expect.arrayContaining([expect.objectContaining({ path: "lakay.project.json" }), expect.objectContaining({ path: "lakay-source/source-files.json" }), expect.objectContaining({ path: "client/src/main.tsx" }), expect.objectContaining({ path: "server/index.ts" }), expect.objectContaining({ path: "drizzle/schema.ts" })]) }),
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
    vi.mocked(db.listRunnerJobsForUser).mockResolvedValue([] as never);
    vi.mocked(db.createRunnerJobForUser).mockResolvedValue(job as never);
    vi.mocked(db.upsertRunnerProfileForUser).mockResolvedValue({ ...profile, status: "build_queued" } as never);

    await expect(caller.queueRunnerJob({ projectId: project.id })).resolves.toMatchObject({ id: "runner-job", state: "queued" });

    expect(db.createRunnerJobForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, expiresAt: expect.any(Date), handoffToken: expect.any(String), artifact: expect.objectContaining({ policy: expect.objectContaining({ network: "deny_by_default" }) }) }));
    expect(db.createRunnerJobLogForUser).toHaveBeenCalledWith(expect.objectContaining({ jobId: "runner-job", userId: 1, level: "info", message: expect.not.stringMatching(/token|secret/i) }));
    expect(db.upsertRunnerProfileForUser).toHaveBeenCalledWith(expect.objectContaining({ status: "build_queued", events: [expect.objectContaining({ state: "build_queued" })] }));
  });

  it("refuses a second runner handoff while an owned job remains active", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const manifest = { version: "2026-08", runtime: "node20", projectKind: "full_stack_web_app", framework: "vite_react_express", entrypoints: { client: "client/src/main.tsx", server: "server/index.ts", build: "pnpm build", start: "pnpm start" }, services: { api: true, database: "isolated_namespaced", storage: "scoped" }, isolation: { network: "deny_by_default", secrets: "runner_scoped_only", lifecycle: "ephemeral_job" }, capabilities: { staticPreview: true, runnerRequired: true, autoFixStateMachine: true }, scaffold: { files: [{ path: "package.json", language: "json", purpose: "Scripts", content: "{}" }] } } as never;
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getRunnerProfileForUser).mockResolvedValue({ projectId: project.id, userId: 1, mode: "full_stack_runner", status: "build_queued", manifest, diagnostics: [], events: [], updatedAt: new Date() } as never);
    vi.mocked(db.listRunnerJobsForUser).mockResolvedValue([{ id: "active-job", state: "building" }] as never);

    await expect(caller.queueRunnerJob({ projectId: project.id })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.createRunnerJobForUser).not.toHaveBeenCalled();
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
