export type RunnerExecutionMode = "static" | "full_stack_runner";
export type RunnerProfileStatus = "static_preview_ready" | "runner_required" | "runner_connected" | "build_queued" | "build_failed";

export type FullStackRunnerManifest = {
  version: "2026-08";
  runtime: "node20";
  projectKind: "full_stack_web_app";
  framework: "vite_react_express";
  entrypoints: { client: string; server: string; build: string; start: string };
  services: { api: true; database: "isolated_namespaced"; storage: "scoped" };
  isolation: { network: "deny_by_default"; secrets: "runner_scoped_only"; lifecycle: "ephemeral_job" };
  capabilities: { staticPreview: true; runnerRequired: true; autoFixStateMachine: true };
  scaffold: { files: RunnerScaffoldFile[] };
};

export type RunnerScaffoldFile = { path: string; language: "json" | "typescript" | "tsx" | "sql"; purpose: string; content: string };
export type RunnerStatusEvent = { state: RunnerProfileStatus; message: string; occurredAt: string };

export function createRunnerStatusEvent(state: RunnerProfileStatus, message: string): RunnerStatusEvent {
  return { state, message, occurredAt: new Date().toISOString() };
}

export function createRunnerScaffold(projectName: string): RunnerScaffoldFile[] {
  const safeName = projectName.replace(/[<>]/g, "").slice(0, 120) || "Lakay application";
  return [
    { path: "package.json", language: "json", purpose: "Defines runner-installed dependencies and safe build scripts.", content: JSON.stringify({ name: safeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "lakay-app", private: true, scripts: { dev: "concurrently \"vite\" \"tsx watch server/index.ts\"", build: "vite build && tsc -p server/tsconfig.json", start: "node dist/server/index.js", test: "vitest run" } }, null, 2) },
    { path: "client/src/main.tsx", language: "tsx", purpose: "Client entry point for the isolated web application.", content: `export function App() { return <main><h1>${safeName}</h1><p>Runner-ready Lakay application.</p></main>; }` },
    { path: "server/index.ts", language: "typescript", purpose: "Server entry point with runner-provided port and scoped environment.", content: "import express from 'express';\nconst app = express();\napp.get('/api/health', (_req, res) => res.json({ ok: true }));\napp.listen(process.env.PORT);" },
    { path: "server/routes/health.ts", language: "typescript", purpose: "Example protected API route boundary.", content: "export const health = () => ({ ok: true });" },
    { path: "drizzle/schema.ts", language: "typescript", purpose: "Namespaced database schema placeholder for the runner-provisioned database.", content: "// Runner-provisioned database schema belongs here. Never use Lakay control-plane credentials." },
    { path: "README.runner.md", language: "typescript", purpose: "Explains the isolated runner contract and deployment handoff.", content: "This scaffold must run only in the Lakay isolated runner with scoped secrets, deny-by-default networking, and a project-namespaced database." },
  ];
}

export const FULL_STACK_RUNNER_MANIFEST: FullStackRunnerManifest = {
  version: "2026-08",
  runtime: "node20",
  projectKind: "full_stack_web_app",
  framework: "vite_react_express",
  entrypoints: { client: "client/src/main.tsx", server: "server/index.ts", build: "pnpm build", start: "pnpm start" },
  services: { api: true, database: "isolated_namespaced", storage: "scoped" },
  isolation: { network: "deny_by_default", secrets: "runner_scoped_only", lifecycle: "ephemeral_job" },
  capabilities: { staticPreview: true, runnerRequired: true, autoFixStateMachine: true },
  scaffold: { files: createRunnerScaffold("Lakay application") },
};

const SAFE_SCAFFOLD_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,180}\.(?:json|ts|tsx|sql|md)$/;

export function validateFullStackRunnerManifest(manifest: FullStackRunnerManifest): string[] {
  const issues: string[] = [];
  if (manifest.version !== "2026-08") issues.push("Unsupported runner contract version.");
  if (manifest.runtime !== "node20" || manifest.framework !== "vite_react_express") issues.push("Unsupported full-stack runtime contract.");
  if (manifest.isolation.network !== "deny_by_default" || manifest.isolation.secrets !== "runner_scoped_only" || manifest.isolation.lifecycle !== "ephemeral_job") issues.push("Runner isolation requirements are incomplete.");
  if (!manifest.capabilities.runnerRequired || !manifest.capabilities.autoFixStateMachine) issues.push("Runner capability safeguards are incomplete.");
  if (!manifest.scaffold.files.length) issues.push("Runner scaffold must contain project files.");
  const seen = new Set<string>();
  manifest.scaffold.files.forEach(file => {
    if (!SAFE_SCAFFOLD_PATH.test(file.path)) issues.push(`Unsafe runner scaffold path: ${file.path}`);
    if (seen.has(file.path)) issues.push(`Duplicate runner scaffold path: ${file.path}`);
    seen.add(file.path);
    if (!file.content.trim() || !file.purpose.trim()) issues.push(`Incomplete runner scaffold file: ${file.path}`);
  });
  return issues;
}

export function assertValidFullStackRunnerManifest(manifest: FullStackRunnerManifest): void {
  const issues = validateFullStackRunnerManifest(manifest);
  if (issues.length) throw new Error(`Invalid full-stack runner contract: ${issues.join(" ")}`);
}
