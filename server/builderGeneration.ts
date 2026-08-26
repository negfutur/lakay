import type { Project } from "../drizzle/schema";
import { isSafeBuilderFilePath, type BuilderFile, type BuilderFilePath } from "../shared/builder";
import type { BuildProjectContext } from "./projectBuildContext";
import { invokeLakayWithFallback } from "./projectPlanning";
import type { GeminiRoute } from "./gemini";
import { assertValidStaticBuild } from "./staticBuildValidation";

const DEFAULT_FILE_PATHS: BuilderFilePath[] = ["index.html", "styles.css", "data.js", "state.js", "components.js", "app.js"];

const WEBSITE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    quality: {
      type: "object",
      properties: {
        visualDirection: { type: "string" },
        primaryWorkflow: { type: "string" },
        interactions: { type: "array", items: { type: "string" } },
      },
      required: ["visualDirection", "primaryWorkflow", "interactions"],
      additionalProperties: false,
    },
    files: {
      type: "object",
      properties: {
        "index.html": { type: "string" },
        "styles.css": { type: "string" },
        "data.js": { type: "string" },
        "state.js": { type: "string" },
        "components.js": { type: "string" },
        "app.js": { type: "string" },
      },
      required: ["index.html", "styles.css", "data.js", "state.js", "components.js", "app.js"],
      additionalProperties: false,
    },
  },
  required: ["summary", "files"],
  additionalProperties: false,
} as const;

function languageForPath(path: BuilderFilePath): BuilderFile["language"] {
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".css")) return "css";
  return "javascript";
}

function normaliseFiles(value: unknown): BuilderFile[] {
  const rawFiles = value && typeof value === "object" ? (value as { files?: unknown }).files : undefined;
  if (!rawFiles || (!Array.isArray(rawFiles) && typeof rawFiles !== "object")) {
    throw new Error("Lakay did not return usable website files.");
  }
  const byPath = new Map<BuilderFilePath, BuilderFile>();
  const entries = Array.isArray(rawFiles)
    ? rawFiles
    : Object.entries(rawFiles as Record<string, unknown>).map(([path, content]) => ({ path, content }));
  for (const item of entries) {
    if (!item || typeof item !== "object") continue;
    const file = item as { path?: unknown; content?: unknown };
    if (typeof file.path !== "string" || !isSafeBuilderFilePath(file.path) || typeof file.content !== "string" || file.content.trim().length === 0) continue;
    const path = file.path as BuilderFilePath;
    byPath.set(path, { path, language: languageForPath(path), content: file.content.trim() });
  }
  if (!DEFAULT_FILE_PATHS.every(path => byPath.has(path))) {
    throw new Error(`Lakay returned an incomplete website build. Missing: ${DEFAULT_FILE_PATHS.filter(path => !byPath.has(path)).join(", ")}. Please try again.`);
  }
  const additional = Array.from(byPath.keys()).filter(path => !DEFAULT_FILE_PATHS.includes(path)).sort();
  return [...DEFAULT_FILE_PATHS, ...additional].map(path => byPath.get(path) as BuilderFile);
}

export function parseWebsiteBuildContent(content: string): { summary?: unknown; files?: unknown } {
  const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const firstObject = trimmed.indexOf("{");
  const lastObject = trimmed.lastIndexOf("}");
  const candidate = firstObject >= 0 && lastObject >= firstObject ? trimmed.slice(firstObject, lastObject + 1) : trimmed;
  try {
    return JSON.parse(candidate) as { summary?: unknown; files?: unknown };
  } catch {
    throw new Error("Lakay received an incomplete structured build response. Please retry this build.");
  }
}

export async function generateWebsiteFiles({
  project,
  instruction,
  existingFiles,
  projectContext,
}: {
  project: Project;
  instruction?: string;
  existingFiles?: BuilderFile[];
  projectContext?: BuildProjectContext;
}): Promise<{ summary: string; files: BuilderFile[]; model: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } }> {
  const route: GeminiRoute = existingFiles?.length ? "followup" : "initial";
  const createBuildRequest = (retry: boolean) => invokeLakayWithFallback({
    preferGemini: true,
    geminiRoute: route,
    messages: [
      {
        role: "system",
        content: `You are Lakay Build, a senior front-end product engineer and product designer. Create a refined, complete, responsive static web application from the provided project context. Return exactly six coordinated files: index.html, styles.css, data.js, state.js, components.js, and app.js.

Quality bar for every first build:
1. Identify one clear primary user and their most valuable workflow from the project description. Build that workflow end to end with useful seeded data, meaningful labels, and a visible successful outcome; do not deliver a generic dashboard shell.
2. Choose a deliberate visual direction appropriate to the product (palette, hierarchy, spacing, surfaces, and responsive layout). It must feel authored for this project, not copied from a generic template. Do not use lorem ipsum, placeholder company names, fake testimonials, or invented customer reviews.
3. Make the main interaction genuinely work in the sandbox: use local state, validation, filters, selection, step progression, or create/edit actions as appropriate. Include useful empty, active, and success or error feedback states where relevant.
4. Make mobile behavior intentional. Use semantic HTML, accessible labels, clear focus states, and responsive CSS with at least one small-screen adaptation. Keep navigation labels compact and non-wrapping where appropriate; use small responsive type rather than accidental line breaks.
5. Never use system emoji as interface icons. Use clean inline SVG icons or simple CSS shapes with accessible labels. Add white-space: nowrap to compact navigation buttons and adjust label sizing to prevent broken words. Give internal navigation cards a professional light surface, fine slate borders, and subtle shadows.
6. Give each of the six files a real responsibility: shared content in data.js, state transitions in state.js, reusable rendering in components.js, and composition/event handlers in app.js. Do not leave stub files.

Use only semantic HTML, modern CSS, and vanilla JavaScript; no build tools, packages, ES module imports, remote assets, analytics, fetch calls, or iframes. Never imitate or call an AI provider from the generated application, never reference Gemini/API keys/quotas in user-facing copy, and never add a provider-error screen. The preview loads data.js, state.js, components.js, then app.js in that order. The result must work as a self-contained front-end in a sandboxed browser preview. Keep the total source focused: target 350–650 lines across all six files, omit prose comments, and prioritize a complete valid JSON response over optional flourish. In the quality object, briefly state the chosen visual direction, primary workflow, and working interactions. ${retry ? "Your previous output was incomplete. Return a smaller complete six-file build now; do not omit or truncate any file." : ""} Do not wrap code in Markdown fences.`,
      },
      {
        role: "user",
        content: `Project name: ${project.name}\nProject description: ${project.description}\nProject plan: ${JSON.stringify(project.generatedPlan)}\n\n${existingFiles?.length ? `Current website files: ${JSON.stringify(existingFiles)}\n\nStructured project analysis: ${JSON.stringify(projectContext)}\n\nUse the project memory to preserve completed work, avoid undoing recent requested changes, and apply this requested change with care:` : "Build direction:"} ${instruction?.trim() || "Create the strongest focused first version of this product."}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "lakay_static_website_build",
        strict: true,
        schema: WEBSITE_SCHEMA,
      },
    },
    max_tokens: 32_000,
  });

  let firstFailure: unknown;
  for (const retry of [false, true]) {
    try {
      const response = await createBuildRequest(retry);
      const content = response.choices[0]?.message.content;
      if (typeof content !== "string" || !content.trim()) throw new Error("Lakay could not create this website build.");
      const raw = parseWebsiteBuildContent(content);
      const files = normaliseFiles(raw);
      assertValidStaticBuild(files);
      return {
        summary: typeof raw.summary === "string" ? raw.summary : "A generated Lakay website build.",
        files,
        model: response.model,
        usage: response.usage,
      };
    } catch (error) {
      if (!retry) {
        firstFailure = error;
        continue;
      }
      throw firstFailure instanceof Error ? firstFailure : error;
    }
  }
  throw new Error("Lakay could not create this website build.");
}
