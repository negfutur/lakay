import type { Project } from "../drizzle/schema";
import type { BuilderFile, BuilderFilePath } from "../shared/builder";
import type { BuildProjectContext } from "./projectBuildContext";
import { invokeLLM } from "./_core/llm";
import { selectLakayModel } from "./projectPlanning";
import { assertValidStaticBuild } from "./staticBuildValidation";

const FILE_PATHS: BuilderFilePath[] = ["index.html", "styles.css", "data.js", "state.js", "components.js", "app.js"];

const WEBSITE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    files: {
      type: "array",
      items: {
        type: "object",
        properties: {
          path: { type: "string", enum: FILE_PATHS },
          language: { type: "string", enum: ["html", "css", "javascript"] },
          content: { type: "string" },
        },
        required: ["path", "language", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "files"],
  additionalProperties: false,
} as const;

const languageForPath: Record<BuilderFilePath, BuilderFile["language"]> = {
  "index.html": "html",
  "styles.css": "css",
  "data.js": "javascript",
  "state.js": "javascript",
  "components.js": "javascript",
  "app.js": "javascript",
};

function normaliseFiles(value: unknown): BuilderFile[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { files?: unknown }).files)) {
    throw new Error("Lakay did not return usable website files.");
  }
  const byPath = new Map<BuilderFilePath, BuilderFile>();
  for (const item of (value as { files: unknown[] }).files) {
    if (!item || typeof item !== "object") continue;
    const file = item as { path?: unknown; content?: unknown };
    if (!FILE_PATHS.includes(file.path as BuilderFilePath) || typeof file.content !== "string" || file.content.trim().length === 0) continue;
    const path = file.path as BuilderFilePath;
    byPath.set(path, { path, language: languageForPath[path], content: file.content.trim() });
  }
  if (byPath.size !== FILE_PATHS.length) {
    throw new Error("Lakay returned an incomplete website build. Please try again.");
  }
  return FILE_PATHS.map(path => byPath.get(path) as BuilderFile);
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
}): Promise<{ summary: string; files: BuilderFile[] }> {
  const model = await selectLakayModel();
  const response = await invokeLLM({
    model,
    messages: [
      {
        role: "system",
        content: `You are Lakay Build, a senior front-end product engineer. Create a refined, complete, responsive static web application from the provided project context. Return exactly six coordinated files: index.html, styles.css, data.js, state.js, components.js, and app.js. Use only semantic HTML, modern CSS, and vanilla JavaScript; no build tools, packages, ES module imports, remote assets, analytics, fetch calls, or iframes. The preview loads data.js, state.js, components.js, then app.js in that order. Keep shared data in data.js, state transitions in state.js, reusable DOM rendering in components.js, and application composition/event handlers in app.js. The result must work as a self-contained front-end in a sandboxed browser preview. Make interactions real (menus, filters, toggles, local state, validation) when appropriate. Use thoughtful typography, spacing, accessibility labels, keyboard-friendly controls, and a distinct visual direction. Do not wrap code in Markdown fences.`,
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
  });

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Lakay could not create this website build.");
  const raw = JSON.parse(content) as { summary?: unknown; files?: unknown };
  const files = normaliseFiles(raw);
  assertValidStaticBuild(files);
  return {
    summary: typeof raw.summary === "string" ? raw.summary : "A generated Lakay website build.",
    files,
  };
}
