import type { Project } from "../drizzle/schema";
import type { BuilderFile } from "../shared/builder";
import { backgroundTaskProgress, type BackgroundTaskState, isTerminalBackgroundTaskState } from "../shared/backgroundTasks";
import { parseWebsiteBuildResult, WEBSITE_SCHEMA } from "./builderGeneration";
import * as db from "./db";
import { cancelGeminiBackgroundInteraction, createGeminiBackgroundInteraction, getGeminiBackgroundInteraction, GeminiProviderError } from "./gemini";
import { invokeLakayProvider, invokeLakayProviderAfterGemini } from "./aiProvider";
import { createBuildProjectContext } from "./projectBuildContext";
import { storageGetSignedUrl } from "./storage";
import { assertValidStaticBuild } from "./staticBuildValidation";

type StoredVisualReference = {
  key: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
};

export const MAX_BACKGROUND_TASK_RETRIES = 2;
export const GEMINI_BACKGROUND_RESCUE_AFTER_MS = 45_000;

function asTaskState(status: string): BackgroundTaskState {
  return ["queued", "in_progress", "requires_action", "completed", "failed", "cancelled"].includes(status)
    ? status as BackgroundTaskState
    : "failed";
}

function backgroundBuildRequest(project: Project, files: BuilderFile[], instruction: string, projectContext: ReturnType<typeof createBuildProjectContext>, history: Array<{ role: string; content: string }>, referenceImageDataUrl?: string) {
  const prompt = `Project: ${project.name}\nDescription: ${project.description}\nTarget: ${project.target}\nPlan: ${JSON.stringify(project.generatedPlan)}\n\nFull persisted conversation: ${JSON.stringify(history)}\n\nCurrent files: ${JSON.stringify(files)}\n\nProject context: ${JSON.stringify(projectContext)}\n\n${referenceImageDataUrl ? "The attached image is a visual reference or a problem screenshot. Analyze it carefully, preserve only useful visual intent, and do not copy brands, logos, private text, or protected artwork.\n\n" : ""}Requested incremental change: ${instruction}`;
  return {
    messages: [
      {
        role: "system" as const,
        content: `You are Lakay Build, a senior product engineer. Apply the requested change incrementally to the existing project. Preserve working behavior, return exactly six coordinated files (index.html, styles.css, data.js, state.js, components.js, app.js), and provide only complete valid JSON. Use semantic HTML, modern CSS and vanilla JavaScript. Do not use remote assets, packages, fetch calls, iframes, API keys, fake testimonials, or emoji UI icons. The primary journey must work responsively and include a visible result state.`,
      },
      {
        role: "user" as const,
        content: referenceImageDataUrl ? [{ type: "text" as const, text: prompt }, { type: "image_url" as const, image_url: { url: referenceImageDataUrl, detail: "high" as const } }] : prompt,
      },
    ],
    response_format: { type: "json_schema" as const, json_schema: { name: "lakay_static_website_build", strict: true, schema: WEBSITE_SCHEMA } },
    max_tokens: 32_000,
  };
}

async function getStoredVisualReferenceDataUrl(userId: number, projectId: string, reference?: StoredVisualReference) {
  if (!reference) return undefined;
  const allowedPrefixes = [`initial-attachments/${userId}/${projectId}/`, `builder-attachments/${userId}/${projectId}/`];
  if (!allowedPrefixes.some(prefix => reference.key.startsWith(prefix))) throw new Error("La référence visuelle n’appartient pas à ce projet.");
  const response = await fetch(await storageGetSignedUrl(reference.key));
  if (!response.ok) throw new Error("La référence visuelle est introuvable.");
  const mimeType = response.headers.get("content-type")?.split(";")[0] || reference.mimeType;
  if (mimeType !== reference.mimeType || !/^(image\/jpeg|image\/png|image\/webp)$/.test(mimeType)) throw new Error("La référence visuelle n’est pas dans un format pris en charge.");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.byteLength > 5_000_000) throw new Error("La référence visuelle dépasse la limite autorisée.");
  return `data:${mimeType};base64,${bytes.toString("base64")}`;
}

async function refundBackgroundTask(task: NonNullable<Awaited<ReturnType<typeof db.getBackgroundTaskForUser>>>) {
  if (!task.creditsCharged || !task.creditOperation || !task.creditIdempotencyKey) return;
  await db.refundCreditForUser({ userId: task.userId, credits: task.creditsCharged, operation: task.creditOperation, idempotencyKey: task.creditIdempotencyKey });
}

async function failBackgroundTask(task: NonNullable<Awaited<ReturnType<typeof db.getBackgroundTaskForUser>>>, message: string, status: BackgroundTaskState = "failed") {
  await refundBackgroundTask(task);
  const updated = await db.updateBackgroundTaskForUser({
    userId: task.userId,
    projectId: task.projectId,
    taskId: task.id,
    status,
    progress: backgroundTaskProgress(status),
    failureMessage: message.slice(0, 4_000),
    cancelledAt: status === "cancelled" ? new Date() : null,
  });
  return updated;
}

function shouldRescueGeminiBackgroundSubmission(error: unknown) {
  return error instanceof GeminiProviderError && (error.status === 408 || error.status === 429 || error.status >= 500 || /no longer available|deprecated model|model.+retired/i.test(error.message));
}

function backgroundTaskHasStalled(task: NonNullable<Awaited<ReturnType<typeof db.getBackgroundTaskForUser>>>) {
  return Date.now() - new Date(task.createdAt).getTime() >= GEMINI_BACKGROUND_RESCUE_AFTER_MS;
}

async function rescueGeminiBackgroundTask(task: NonNullable<Awaited<ReturnType<typeof db.getBackgroundTaskForUser>>>, reason: string) {
  const geminiInteractionId = task.providerInteractionId;
  if (!geminiInteractionId || geminiInteractionId.startsWith("openrouter-rescue:")) return task;
  const claimed = await db.claimBackgroundTaskRescueForUser({
    userId: task.userId,
    projectId: task.projectId,
    taskId: task.id,
    geminiInteractionId,
      progress: "Gemini Flash est indisponible ou trop lent. Lakay essaie Gemini Pro, puis un second moteur IA si nécessaire…",
  });
  if (!claimed) return db.getBackgroundTaskForUser(task.userId, task.projectId, task.id);
  try {
    const [project, files, history] = await Promise.all([
      db.getProjectForUser(task.userId, task.projectId),
      db.listBuilderFilesForUser(task.userId, task.projectId),
      db.listProjectMessagesForUser(task.userId, task.projectId),
    ]);
    if (!project) return failBackgroundTask(task, "Le projet n’est plus disponible.");
    const reference = task.visualReferenceKey && task.visualReferenceMimeType && ["image/jpeg", "image/png", "image/webp"].includes(task.visualReferenceMimeType)
      ? { key: task.visualReferenceKey, mimeType: task.visualReferenceMimeType as StoredVisualReference["mimeType"] }
      : undefined;
    const referenceImageDataUrl = await getStoredVisualReferenceDataUrl(task.userId, task.projectId, reference);
    const request = backgroundBuildRequest(project, files, task.instruction, createBuildProjectContext(files, []), history.map(message => ({ role: message.role, content: message.content })), referenceImageDataUrl);
    const response = await invokeLakayProviderAfterGemini(request, {
      task: files.length ? "build_followup" : "build_initial",
      preferMultimodal: Boolean(referenceImageDataUrl),
      requiredCapabilities: referenceImageDataUrl ? ["vision", "structured_output", "coding"] : ["structured_output", "coding"],
      quality: "high",
    });
    const outputText = response.choices[0]?.message.content;
    if (typeof outputText !== "string" || !outputText.trim()) throw new Error("Le service de secours a retourné une réponse vide.");
    return completeBackgroundTask(task, outputText, response.lakayProvider, response.model, response.usage);
  } catch (error) {
    return failBackgroundTask(task, `${reason} ${error instanceof Error ? error.message : "Le service de secours n’a pas pu terminer la tâche."}`);
  }
}

async function completeBackgroundTask(
  task: NonNullable<Awaited<ReturnType<typeof db.getBackgroundTaskForUser>>>,
  outputText: string,
  provider: string,
  model: string,
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
) {
  const files = await db.listBuilderFilesForUser(task.userId, task.projectId);
  const parsed = parseWebsiteBuildResult(outputText, files);
  assertValidStaticBuild(parsed.files);
  const result = await db.replaceBuilderFilesForUser({ userId: task.userId, projectId: task.projectId, files: parsed.files, instruction: task.instruction, summary: parsed.summary, origin: "generate" });
  if (!result) return failBackgroundTask(task, "Le projet n’est plus disponible.");
  await db.recordAiGenerationUsage({
    userId: task.userId,
    projectId: task.projectId,
    operation: task.creditOperation || "builder_background_generate",
    provider,
    model,
    promptTokens: usage?.prompt_tokens || 0,
    candidateTokens: usage?.completion_tokens || 0,
    totalTokens: usage?.total_tokens || 0,
    creditsCharged: task.creditsCharged || 0,
    requestId: `background_task:${task.id}`,
  });
  const updated = await db.updateBackgroundTaskForUser({ userId: task.userId, projectId: task.projectId, taskId: task.id, status: "completed", progress: backgroundTaskProgress("completed"), resultSummary: parsed.summary, resultVersionId: result.versionId, completedAt: new Date() });
  await db.createProjectMessage({ projectId: task.projectId, userId: task.userId, role: "assistant", content: `Modification terminée : ${parsed.summary}\n\n[[lakay:open-preview]]` });
  return updated;
}

export async function submitBackgroundBuilderTask(input: { userId: number; project: Project; files: BuilderFile[]; history: Array<{ role: string; content: string }>; instruction: string; requestId: string; visualReference?: StoredVisualReference; retryOfTaskId?: string; creditsCharged: number; creditOperation?: string; creditIdempotencyKey?: string; providerPreference?: "openrouter_rescue" }) {
  const task = await db.createBackgroundTaskForUser({
    userId: input.userId,
    projectId: input.project.id,
    requestId: input.requestId,
    instruction: input.instruction,
    visualReferenceKey: input.visualReference?.key,
    visualReferenceMimeType: input.visualReference?.mimeType,
    retryOfTaskId: input.retryOfTaskId,
    creditsCharged: input.creditsCharged,
    creditOperation: input.creditOperation,
    creditIdempotencyKey: input.creditIdempotencyKey,
  });
  if (!task) throw new Error("Le projet n’est plus disponible.");
  if (!input.retryOfTaskId) await db.createProjectMessage({ projectId: input.project.id, userId: input.userId, role: "user", content: input.instruction });
  const referenceImageDataUrl = await getStoredVisualReferenceDataUrl(input.userId, input.project.id, input.visualReference);
  const request = backgroundBuildRequest(input.project, input.files, input.instruction, createBuildProjectContext(input.files, []), input.history, referenceImageDataUrl);
  if (input.providerPreference === "openrouter_rescue") {
    await db.claimBackgroundTaskRescueForUser({
      userId: input.userId,
      projectId: input.project.id,
      taskId: task.id,
      geminiInteractionId: task.providerInteractionId,
      progress: "Les essais Gemini Flash sont terminés. Lakay essaie Gemini Pro, puis un second moteur IA si nécessaire…",
    });
    try {
      const response = await invokeLakayProviderAfterGemini(request, {
        task: input.files.length ? "build_followup" : "build_initial",
        preferMultimodal: Boolean(referenceImageDataUrl),
        requiredCapabilities: referenceImageDataUrl ? ["vision", "structured_output", "coding"] : ["structured_output", "coding"],
        quality: "high",
      });
      const outputText = response.choices[0]?.message.content;
      if (typeof outputText !== "string" || !outputText.trim()) throw new Error("Le service de secours a retourné une réponse vide.");
      return completeBackgroundTask(task, outputText, response.lakayProvider, response.model, response.usage);
    } catch (error) {
      await failBackgroundTask(task, error instanceof Error ? error.message : "Le service de secours n’a pas pu terminer cette tâche.");
      throw error;
    }
  }
  try {
    const interaction = await createGeminiBackgroundInteraction(request, input.files.length ? "followup" : "initial");
    return db.attachBackgroundTaskInteractionForUser({
      userId: input.userId,
      projectId: input.project.id,
      taskId: task.id,
      interactionId: interaction.id,
      model: interaction.model,
      status: asTaskState(interaction.status),
      progress: backgroundTaskProgress(asTaskState(interaction.status)),
    });
  } catch (error) {
    if (!shouldRescueGeminiBackgroundSubmission(error)) {
      await failBackgroundTask(task, error instanceof Error ? error.message : "La tâche en arrière-plan n’a pas pu être créée.");
      throw error;
    }
    try {
      const response = await invokeLakayProvider(request, {
        task: input.files.length ? "build_followup" : "build_initial",
        preferMultimodal: Boolean(referenceImageDataUrl),
        requiredCapabilities: referenceImageDataUrl ? ["vision", "structured_output", "coding"] : ["structured_output", "coding"],
        quality: "high",
      });
      const outputText = response.choices[0]?.message.content;
      if (typeof outputText !== "string" || !outputText.trim()) throw new Error("Le fournisseur de secours a retourné une réponse vide.");
      return completeBackgroundTask(task, outputText, response.lakayProvider, response.model, response.usage);
    } catch (fallbackError) {
      await failBackgroundTask(task, fallbackError instanceof Error ? fallbackError.message : "La tâche en arrière-plan n’a pas pu être terminée.");
      throw fallbackError;
    }
  }
}

export async function synchronizeBackgroundTaskForUser(userId: number, projectId: string, taskId: string) {
  const task = await db.getBackgroundTaskForUser(userId, projectId, taskId);
  if (!task || isTerminalBackgroundTaskState(task.status as BackgroundTaskState) || !task.providerInteractionId) return task;
  if (task.providerInteractionId.startsWith("openrouter-rescue:")) return task;
  try {
    const interaction = await getGeminiBackgroundInteraction(task.providerInteractionId);
    const status = asTaskState(interaction.status);
    if (status === "in_progress" || status === "queued" || status === "requires_action") {
      if (backgroundTaskHasStalled(task)) return rescueGeminiBackgroundTask(task, "Gemini n’a pas terminé dans le délai prévu.");
      return db.updateBackgroundTaskForUser({ userId, projectId, taskId, status, progress: backgroundTaskProgress(status) });
    }
    if (status === "cancelled") return failBackgroundTask(task, "La tâche a été annulée par Gemini.", "cancelled");
    if (status === "failed") return rescueGeminiBackgroundTask(task, interaction.errorMessage || "Gemini n’a pas pu terminer cette tâche.");
    if (!interaction.outputText) return rescueGeminiBackgroundTask(task, "Gemini a terminé sans résultat exploitable.");
    return completeBackgroundTask(task, interaction.outputText, "gemini", interaction.model || task.providerModel || "gemini-background", interaction.usage);
  } catch (error) {
    if (shouldRescueGeminiBackgroundSubmission(error)) return rescueGeminiBackgroundTask(task, "La synchronisation Gemini a échoué.");
    return failBackgroundTask(task, error instanceof Error ? error.message : "La synchronisation de la tâche a échoué.");
  }
}

export async function synchronizeBackgroundTasksForUser(userId: number, projectId: string) {
  const tasks = (await db.listBackgroundTasksForUser(userId, projectId)) || [];
  for (const task of tasks) {
    if (!isTerminalBackgroundTaskState(task.status as BackgroundTaskState) && task.providerInteractionId) await synchronizeBackgroundTaskForUser(userId, projectId, task.id);
  }
  return (await db.listBackgroundTasksForUser(userId, projectId)) || [];
}

export async function cancelBackgroundTaskForUser(userId: number, projectId: string, taskId: string) {
  const task = await db.getBackgroundTaskForUser(userId, projectId, taskId);
  if (!task) return undefined;
  if (isTerminalBackgroundTaskState(task.status as BackgroundTaskState)) return task;
  try {
    if (task.providerInteractionId && !task.providerInteractionId.startsWith("openrouter-rescue:")) await cancelGeminiBackgroundInteraction(task.providerInteractionId);
    return failBackgroundTask(task, "Annulée par l’utilisateur.", "cancelled");
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "La tâche n’a pas pu être annulée.");
  }
}
