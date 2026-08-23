import { createRunnerScaffold, FULL_STACK_RUNNER_MANIFEST, type FullStackRunnerManifest } from "../shared/runner";

export function createFullStackRunnerManifest(projectName: string): FullStackRunnerManifest {
  return { ...FULL_STACK_RUNNER_MANIFEST, scaffold: { files: createRunnerScaffold(projectName) } };
}

export function runnerRequiredDiagnostics() {
  return [
    "No isolated full-stack runner is connected to this Lakay deployment.",
    "Static front-end files remain previewable in the browser sandbox.",
    "Backend, API, package install, database migration, and server logs require the dedicated runner contract.",
  ];
}
