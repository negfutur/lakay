import type { BuilderFile, BuilderVersion } from "../shared/builder";

type ProjectCapability = "forms" | "local_state" | "navigation" | "interactive_controls" | "network_blocked";

export type BuildProjectContext = {
  files: Array<{
    path: string;
    language: string;
    lines: number;
    characters: number;
  }>;
  capabilities: ProjectCapability[];
  recentMemory: Array<{
    origin: BuilderVersion["origin"];
    instruction: string | null;
    summary: string | null;
    createdAt: Date;
  }>;
  executionPolicy: string;
};

export function createBuildProjectContext(files: BuilderFile[], versions: BuilderVersion[] = []): BuildProjectContext {
  const combined = files.map(file => file.content).join("\n");
  const capabilities: ProjectCapability[] = [];
  if (/<form\b|addEventListener\(['"]submit/i.test(combined)) capabilities.push("forms");
  if (/localStorage|sessionStorage/i.test(combined)) capabilities.push("local_state");
  if (/<nav\b|aria-current|addEventListener\(['"]click/i.test(combined)) capabilities.push("navigation");
  if (/addEventListener|<button\b|<details\b|<dialog\b/i.test(combined)) capabilities.push("interactive_controls");
  if (/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\b/i.test(combined)) capabilities.push("network_blocked");

  return {
    files: files.map(file => ({
      path: file.path,
      language: file.language,
      lines: file.content.split("\n").length,
      characters: file.content.length,
    })),
    capabilities,
    recentMemory: versions.slice(0, 8).map(version => ({
      origin: version.origin,
      instruction: version.instruction,
      summary: version.summary,
      createdAt: version.createdAt,
    })),
    executionPolicy: "For any follow-up, inspect the complete existing project first, preserve working workflows and recent decisions, change only what the request requires, and correct any relevant static build, wiring, responsive, or interaction defect in the same incremental pass. Never restart from a blank template or remove unrelated capabilities.",
  };
}
