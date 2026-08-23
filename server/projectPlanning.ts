import { invokeLLM, invokeLLMStream, isRetryableStatus, listLLMModels, LlmProviderQuotaError, LlmProviderRequestError, type InvokeParams, type InvokeResult, type StreamInvokeParams } from "./_core/llm";
import type { ProjectPlan } from "../shared/project";
import { normalizeProjectPlan } from "./projectLogic";
import { invokeGemini, invokeGeminiStream, isGeminiConfigured } from "./gemini";

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

export async function invokeLakayWithFallback(params: Omit<InvokeParams, "model"> & { model?: string }): Promise<InvokeResult> {
  let models: string[] = [];
  try {
    models = params.model ? [params.model, ...(await selectLakayModels()).filter(model => model !== params.model)] : await selectLakayModels();
  } catch (error) {
    if (isGeminiConfigured()) return invokeGemini(params);
    throw error;
  }
  let lastError: unknown;
  for (const model of models) {
    try {
      return await invokeLLM({ ...params, model });
    } catch (error) {
      lastError = error;
      if (!canTryFallback(error)) {
        if (isGeminiConfigured()) return invokeGemini(params);
        throw error;
      }
    }
  }
  if (isGeminiConfigured()) return invokeGemini(params);
  throw lastError instanceof Error ? lastError : new Error("No Lakay LLM fallback model completed the request.");
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

export async function generateProjectPlan(description: string): Promise<ProjectPlan> {
  const response = await invokeLakayWithFallback({
    messages: [
      {
        role: "system",
        content:
          "You are Lakay, an expert product strategist. Turn a product idea into a practical, concise application plan. Avoid invented market claims and keep each list focused on the first useful release.",
      },
      {
        role: "user",
        content: `Create a structured project plan for this idea:\n\n${description}`,
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

  return normalizeProjectPlan(JSON.parse(content));
}
