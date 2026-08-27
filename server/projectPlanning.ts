import { invokeLLM, invokeLLMStream, isRetryableStatus, listLLMModels, LlmProviderQuotaError, LlmProviderRequestError, type InvokeParams, type InvokeResult, type StreamInvokeParams } from "./_core/llm";
import type { ProjectPlan } from "../shared/project";
import { normalizeProjectPlan } from "./projectLogic";
import { invokeGemini, invokeGeminiStream, isGeminiConfigured, type GeminiRoute } from "./gemini";

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    tagline: { type: "string" },
    summary: { type: "string" },
    goals: { type: "array", items: { type: "string" } },
    features: { type: "array", items: { type: "string" } },
    techStack: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: { type: "string" },
          name: { type: "string" },
          reason: { type: "string" },
        },
        required: ["category", "name", "reason"],
        additionalProperties: false,
      },
    },
    components: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          purpose: { type: "string" },
        },
        required: ["name", "purpose"],
        additionalProperties: false,
      },
    },
    milestones: { type: "array", items: { type: "string" } },
  },
  required: ["name", "tagline", "summary", "goals", "features", "techStack", "components", "milestones"],
  additionalProperties: false,
} as const;

export async function selectLakayModels(): Promise<string[]> {
  const { data } = await listLLMModels();
  const preferredModels = ["gpt-5", "claude-sonnet-4-6", "gpt-5-mini", "claude-haiku-4-5"];
  const available = new Set(data.map(model => model.id));
  const preferred = preferredModels.filter(id => available.has(id));
  return preferred.length ? preferred : data.map(model => model.id);
}

export async function selectLakayModel(): Promise<string | undefined> {
  return (await selectLakayModels())[0];
}

function canTryFallback(error: unknown) {
  return error instanceof LlmProviderRequestError && !(error instanceof LlmProviderQuotaError) && isRetryableStatus(error.status);
}

export async function invokeLakayWithFallback(params: Omit<InvokeParams, "model"> & { model?: string; preferGemini?: boolean; geminiRoute?: GeminiRoute }): Promise<InvokeResult> {
  const { preferGemini = false, geminiRoute = "followup", ...invokeParams } = params;
  let geminiError: unknown;
  if (preferGemini && isGeminiConfigured()) {
    try {
      return await invokeGemini(invokeParams, geminiRoute);
    } catch (error) {
      geminiError = error;
    }
  }
  let models: string[] = [];
  try {
    models = invokeParams.model ? [invokeParams.model, ...(await selectLakayModels()).filter(model => model !== invokeParams.model)] : await selectLakayModels();
  } catch (error) {
    if (isGeminiConfigured() && !preferGemini) return invokeGemini(invokeParams, geminiRoute);
    throw geminiError ?? error;
  }
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLM({ ...invokeParams, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) {
        if (isGeminiConfigured()) return invokeGemini(invokeParams, geminiRoute);
        throw error;
      }
    }
  }
  if (isGeminiConfigured() && !preferGemini) return invokeGemini(invokeParams, geminiRoute);
  throw lastError instanceof Error ? lastError : geminiError instanceof Error ? geminiError : new Error("No Lakay LLM fallback model completed the request.");
}

export async function invokeLakayStreamWithFallback(params: Omit<StreamInvokeParams, "model"> & { model?: string }) {
  let models: string[] = [];
  try {
    models = params.model ? [params.model, ...(await selectLakayModels()).filter(model => model !== params.model)] : await selectLakayModels();
  } catch (error) {
    if (isGeminiConfigured()) return invokeGeminiStream(params);
    throw error;
  }
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLMStream({ ...params, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) {
        if (isGeminiConfigured()) return invokeGeminiStream(params);
        throw error;
      }
    }
  }
  if (isGeminiConfigured()) return invokeGeminiStream(params);
  throw lastError instanceof Error ? lastError : new Error("No Lakay LLM fallback model completed the stream request.");
}

function responseText(content: string | unknown[]): string {
  if (typeof content === "string") return content;
  return content
    .map(part =>
      part && typeof part === "object" && "type" in part && (part as { type?: string }).type === "text"
        ? String((part as { text?: string }).text ?? "")
        : ""
    )
    .join("");
}

export async function generateProjectPlanWithUsage(description: string, target: "web" | "mobile" = "web", initialImageDataUrl?: string) {
  const targetDirection = target === "mobile"
    ? "The selected target is a mobile application. Prioritize touch-first navigation, compact mobile flows, reachable primary actions, appropriate native-package metadata, and an Android-first release plan."
    : "The selected target is a web application. Prioritize responsive browser workflows, accessible navigation, desktop and mobile layouts, preview readiness, and a web release plan.";
  const initialPrompt = `Create a structured project plan for this idea:\n\n${description}\n\n${targetDirection}${initialImageDataUrl ? "\n\nA visual reference is attached. Analyze its information hierarchy, interaction clues, and visual direction to inform the plan. Treat it as inspiration only: do not copy brand assets, private text, or distinctive identity details." : ""}`;
  const response = await invokeLakayWithFallback({
    preferGemini: true,
    geminiRoute: "initial",
    messages: [
      {
        role: "system",
        content:
          "You are Lakay, an expert product strategist. Turn a product idea into a practical, specific application plan for a polished first release. Infer the primary user, their key job, the main workflow, meaningful content objects, and a fitting visual direction. Make goals, features, components, and milestones concrete enough for a front-end engineer to build a distinctive useful interface; avoid generic dashboard language, invented market claims, fake reviews, and vague placeholders. If the idea is short or vague, never ask a clarifying question and never refuse: choose sensible defaults for the audience, core workflow, content, and visual direction so a useful V1 can be built immediately and refined later through dialogue.",
      },
      {
        role: "user",
        content: initialImageDataUrl
          ? [
              { type: "text", text: initialPrompt },
              { type: "image_url", image_url: { url: initialImageDataUrl, detail: "high" } },
            ]
          : initialPrompt,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lakay_project_plan",
        strict: true,
        schema: PLAN_SCHEMA,
      },
    },
  });

  const content = responseText(response.choices[0]?.message.content ?? "");
  if (!content) throw new Error("Lakay could not generate a project plan.");

  return { plan: normalizeProjectPlan(JSON.parse(content)), model: response.model, usage: response.usage };
}

export async function generateProjectPlan(description: string, target: "web" | "mobile" = "web", initialImageDataUrl?: string): Promise<ProjectPlan> {
  return (await generateProjectPlanWithUsage(description, target, initialImageDataUrl)).plan;
}
