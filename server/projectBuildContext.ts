import type { BuilderFile, BuilderVersion } from "../shared/builder";
import type { Project } from "../drizzle/schema";
import type { StaticBuildValidation } from "./staticBuildValidation";

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

type ProjectTaskEvidence = { id: string; status: string; progressMessage?: string | null; errorMessage?: string | null; resultVersionId?: string | null; updatedAt: Date };
type ProjectDecisionEvidence = { id: string; type: string; impact: string; status: string; summary: string; updatedAt: Date };
type ProjectExecutionEvidence = { status?: string | null; diagnostics?: string[] | null } | null | undefined;

export type OperationalProjectContext = BuildProjectContext & {
  project_id: string;
  project_name: string;
  project_type: "web" | "mobile";
  objective: string;
  target_users: { value: string; evidence: "declared" | "not_declared" };
  current_features: string[];
  planned_features: string[];
  architecture: string;
  technology_stack: string[];
  integrations: string[];
  database: { state: "not_configured" | "runner_contract_prepared"; evidence: string };
  design_system: { state: "observed" | "not_declared"; evidence: string };
  current_state: {
    real: string[];
    planned: string[];
    in_progress: string[];
    failed: string[];
    verified: string[];
    not_verified: string[];
  };
  known_issues: string[];
  decisions: Array<{ id: string; type: string; impact: string; status: string; summary: string; updatedAt: Date }>;
  completed_tasks: string[];
  pending_tasks: string[];
  user_preferences: { state: "not_recorded"; evidence: string };
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

export function createOperationalProjectContext(input: {
  project: Project;
  files: BuilderFile[];
  versions?: BuilderVersion[];
  history?: Array<{ role: string; content: string }>;
  backgroundTasks?: ProjectTaskEvidence[];
  validation: StaticBuildValidation;
  execution?: ProjectExecutionEvidence;
  decisions?: ProjectDecisionEvidence[];
}): OperationalProjectContext {
  const base = createBuildProjectContext(input.files, input.versions || []);
  const tasks = input.backgroundTasks || [];
  const decisions = input.decisions || [];
  const plan = input.project.generatedPlan;
  const isRunnerPrepared = Boolean(input.execution?.status && input.execution.status !== "static_preview_ready");
  const failedTasks = tasks.filter(task => task.status === "failed");
  const activeTasks = tasks.filter(task => ["queued", "in_progress", "requires_action"].includes(task.status));
  const completedTasks = tasks.filter(task => task.status === "completed");
  const awaitingDecisions = decisions.filter(action => action.status === "awaiting_confirmation");
  const observedStyles = input.files.some(file => file.path.endsWith(".css") || /tailwind|--[a-z-]+\s*:/i.test(file.content));
  const currentFeatures = base.capabilities.map(capability => `Capacité observée : ${capability}`);
  const failedDetails = failedTasks.map(task => task.errorMessage ? `Tâche échouée : ${task.errorMessage.slice(0, 220)}` : "Tâche de génération échouée sans détail exploitable.");
  const validationDetails = input.validation.issues.map(issue => `Validation : ${issue}`);
  const existingHistory = input.history?.length ? [`${input.history.length} message${input.history.length > 1 ? "s" : ""} de conversation conservé${input.history.length > 1 ? "s" : ""}.`] : [];

  return {
    ...base,
    project_id: input.project.id,
    project_name: input.project.name,
    project_type: input.project.target,
    objective: plan?.summary || input.project.description,
    target_users: { value: "Non déclaré explicitement dans le projet.", evidence: "not_declared" },
    current_features: currentFeatures,
    planned_features: plan?.features || [],
    architecture: isRunnerPrepared ? "Contrat d’exécution isolée préparé ; il n’est pas une preuve qu’un service externe fonctionne." : "Aperçu web isolé basé sur les fichiers persistés du projet.",
    technology_stack: plan?.techStack?.map(item => item.name) || [],
    integrations: base.capabilities.includes("network_blocked") ? ["Des appels réseau sont détectés mais bloqués dans l’aperçu isolé."] : ["Aucune intégration externe vérifiée par cet aperçu."],
    database: isRunnerPrepared ? { state: "runner_contract_prepared", evidence: "Un contrat isolé existe ; une base exécutée n’est pas confirmée par cette donnée." } : { state: "not_configured", evidence: "Aucune base active n’est déduite des fichiers de l’aperçu isolé." },
    design_system: observedStyles ? { state: "observed", evidence: "Des styles locaux sont présents dans les fichiers du projet." } : { state: "not_declared", evidence: "Aucun système de design explicite n’est déduit des fichiers actuels." },
    current_state: {
      real: [`${input.files.length} fichier${input.files.length > 1 ? "s" : ""} enregistré${input.files.length > 1 ? "s" : ""}.`, ...currentFeatures, ...existingHistory],
      planned: plan?.features || [],
      in_progress: activeTasks.map(task => task.progressMessage || `Tâche ${task.status}.`),
      failed: [...failedDetails, ...validationDetails],
      verified: input.validation.valid ? ["La structure des fichiers de l’aperçu statique est valide."] : [],
      not_verified: ["Le déploiement externe et les intégrations tierces ne sont pas vérifiés par la validation locale."],
    },
    known_issues: [...validationDetails, ...failedDetails, ...(input.execution?.diagnostics || [])],
    decisions: decisions.map(action => ({ id: action.id, type: action.type, impact: action.impact, status: action.status, summary: action.summary, updatedAt: action.updatedAt })),
    completed_tasks: [...completedTasks.map(task => task.resultVersionId ? `Génération terminée : version ${task.resultVersionId}.` : "Génération terminée."), ...(input.versions || []).slice(0, 8).map(version => version.summary || version.instruction || "Version de projet enregistrée.")],
    pending_tasks: [...activeTasks.map(task => task.progressMessage || `Tâche ${task.status}.`), ...awaitingDecisions.map(action => `Confirmation requise : ${action.summary}`)],
    user_preferences: { state: "not_recorded", evidence: "Les préférences utilisateur ne sont pas encore incluses dans ce contexte de projet." },
  };
}
