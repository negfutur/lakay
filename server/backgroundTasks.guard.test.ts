import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const gemini = readFileSync(resolve(process.cwd(), "server/gemini.ts"), "utf8");
const tasks = readFileSync(resolve(process.cwd(), "server/backgroundTasks.ts"), "utf8");
const builder = readFileSync(resolve(process.cwd(), "server/builder.ts"), "utf8");
const appBuilder = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");
const chat = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");
const providers = readFileSync(resolve(process.cwd(), "server/aiProvider.ts"), "utf8");
const providerCore = readFileSync(resolve(process.cwd(), "server/aiProviderCore.ts"), "utf8");

describe("durable Gemini background task guard", () => {
  it("persists owner-scoped task state and provider interaction identity", () => {
    expect(schema).toContain("projectBackgroundTasks");
    expect(schema).toContain("projectBackgroundTaskStatus");
    expect(schema).toContain('"queued", "in_progress", "requires_action", "completed", "failed", "cancelled"');
    expect(schema).toContain("providerInteractionId");
    expect(schema).toContain("visualReferenceKey");
    expect(schema).toContain("retryOfTaskId");
    expect(schema).toContain("background_tasks_user_project_updated_idx");
    expect(db).toContain("getBackgroundTaskForUser");
    expect(db).toContain("eq(projectBackgroundTasks.userId, userId)");
    expect(db).toContain("eq(projectBackgroundTasks.projectId, projectId)");
  });

  it("uses Gemini’s official durable interaction controls instead of browser-local work", () => {
    expect(gemini).toContain("createGeminiBackgroundInteraction");
    expect(gemini).toContain("getGeminiBackgroundInteraction");
    expect(gemini).toContain("cancelGeminiBackgroundInteraction");
    expect(gemini).toContain("background: true");
    expect(gemini).toContain("store: true");
    expect(gemini).toContain('type: "image"');
    expect(gemini).toContain("mime_type");
    expect(gemini).toContain("/interactions/${encodeURIComponent(interactionId)}/cancel");
  });

  it("recovers full persisted context, validates completed code, and refunds terminal failures", () => {
    expect(tasks).toContain("Full persisted conversation");
    expect(tasks).toContain("synchronizeBackgroundTasksForUser");
    expect(tasks).toContain("parseWebsiteBuildResult");
    expect(tasks).toContain("assertValidStaticBuild(parsed.files)");
    expect(tasks).toContain("replaceBuilderFilesForUser");
    expect(tasks).toContain("refundBackgroundTask");
    expect(tasks).toContain("cancelBackgroundTaskForUser");
    expect(tasks).toContain("getStoredVisualReferenceDataUrl");
    expect(tasks).toContain("visualReferenceKey");
  });

  it("rescues retryable Gemini background-submission failures through the central provider policy", () => {
    expect(tasks).toContain("shouldRescueGeminiBackgroundSubmission");
    expect(tasks).toContain("invokeLakayProvider(request");
    expect(tasks).toContain("response.lakayProvider, response.model, response.usage");
    expect(tasks).toContain('return completeBackgroundTask(task, outputText');
    expect(tasks).toContain('return completeBackgroundTask(task, interaction.outputText, "gemini"');
  });

  it("continues a failed or stalled Gemini Flash interaction through Gemini Pro and OpenRouter before refunding the already-charged task", () => {
    expect(tasks).toContain("GEMINI_BACKGROUND_RESCUE_AFTER_MS = 45_000");
    expect(tasks).toContain("backgroundTaskHasStalled(task)");
    expect(tasks).toContain("rescueGeminiBackgroundTask(task");
    expect(tasks).toContain("claimBackgroundTaskRescueForUser");
    expect(tasks).toContain("invokeLakayProviderAfterGemini(request");
    expect(tasks).toContain('input.providerPreference === "openrouter_rescue"');
    expect(db).toContain("openrouter-rescue:${input.taskId}");
    expect(providers).toContain('geminiRoute: "pro"');
    expect(providers).toContain('providers: ["gemini", "openrouter", "forge"]');
    expect(providerCore).toContain("function providerOrder(providers?");
    expect(tasks.lastIndexOf("return failBackgroundTask(task")).toBeGreaterThan(tasks.indexOf("invokeLakayProviderAfterGemini(request"));
  });

  it("exposes protected submission, synchronization, cancellation, and reconnect-safe Chat controls", () => {
    expect(builder).toContain("startBackgroundGenerate");
    expect(builder).toContain("retryBackgroundGenerate");
    expect(builder).toContain("MAX_BACKGROUND_TASK_RETRIES");
    expect(builder).toContain("Cette demande a déjà été relancée deux fois");
    expect(builder).toContain("syncBackgroundTask");
    expect(builder).toContain("cancelBackgroundTask");
    expect(builder).toContain("synchronizeBackgroundTasksForUser");
    expect(appBuilder).toContain("startBackgroundGenerate.mutate");
    expect(appBuilder).toContain("backgroundTaskLive");
    expect(appBuilder).toContain("setInterval(() => void utils.builder.get.invalidate");
    expect(chat).toContain("backgroundTask?: ChatBackgroundTask | null");
    expect(chat).toContain("Annuler la tâche");
    expect(chat).toContain("La tâche est sauvegardée et reprendra si vous revenez plus tard.");
    expect(chat).toContain("Lakay travaille ·");
    expect(appBuilder).toContain("Analyse du projet et de la demande…");
    expect(appBuilder).toContain("Écriture des écrans et interactions…");
    expect(appBuilder).toContain("Reprise automatique avec le second moteur IA…");
  });

  it("keeps terminal task failures in one retryable Chat surface instead of duplicating assistant messages and preview banners", () => {
    expect(tasks).not.toContain('content: status === "cancelled"');
    expect(appBuilder).toContain("recoverableBackgroundTask");
    expect(appBuilder).toContain("retryBackgroundGenerate.mutate");
    expect(appBuilder).not.toContain("{buildFailure && <div className=\"flex flex-wrap items-start justify-between gap-3 border-b border-rose");
  });
});
