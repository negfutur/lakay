import type { ProjectPlan } from "../shared/project";
import { normalizeProjectPlan } from "./projectLogic";
import { invokeLakayProvider } from "./aiProvider";
export { invokeProviderFallback as invokeLakayWithFallback, invokeProviderStreamFallback as invokeLakayStreamWithFallback, selectAvailableLakayModels as selectLakayModels } from "./aiProviderCore";

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
  const response = await invokeLakayProvider({
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
  }, { task: "planning", preferMultimodal: Boolean(initialImageDataUrl), requiredCapabilities: initialImageDataUrl ? ["vision", "structured_output"] : ["structured_output"], quality: "high" });

  const content = responseText(response.choices[0]?.message.content ?? "");
  if (!content) throw new Error("Lakay could not generate a project plan.");

  return { plan: normalizeProjectPlan(JSON.parse(content)), model: response.model, provider: response.lakayProvider, usage: response.usage };
}

export async function generateProjectPlan(description: string, target: "web" | "mobile" = "web", initialImageDataUrl?: string): Promise<ProjectPlan> {
  return (await generateProjectPlanWithUsage(description, target, initialImageDataUrl)).plan;
}
