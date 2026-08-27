import type { Project } from "../drizzle/schema";
import type { BuilderFile } from "../shared/builder";

export type AgentImpact = "safe" | "moderate" | "high";
export type AgentClarity = "clear" | "sufficient" | "critical_missing" | "ambiguous" | "complex";

export type ProjectAgentAssessment = {
  userRequest: string;
  likelyReason: string;
  desiredOutcome: string;
  projectObjective: string;
  currentContext: string;
  constraints: string[];
  requiredActions: string[];
  clarity: AgentClarity;
  risk: AgentImpact;
};

export type AgentToolName = "project_context" | "project_files" | "builder_generation" | "background_task" | "static_validation" | "isolated_preview" | "database" | "external_integration";
export type AgentToolStatus = "used" | "selected" | "requires_confirmation" | "requires_configuration";
export type AgentToolSelection = { tool: AgentToolName; status: AgentToolStatus; purpose: string };

type ProjectAgentDecisionData =
  | { kind: "conversation"; impact: "safe" }
  | { kind: "clarify"; impact: "safe"; answer: string }
  | { kind: "plan"; impact: "safe"; answer: string }
  | { kind: "modify"; impact: "moderate"; instruction: string }
  | { kind: "confirm"; impact: "high"; instruction: string; summary: string; answer: string }
  | { kind: "confirmed"; impact: "high"; actionId: string; instruction: string; answer: string }
  | { kind: "cancelled"; impact: "safe"; actionId: string; answer: string };

export type ProjectAgentDecision = ProjectAgentDecisionData & { assessment: ProjectAgentAssessment; tools: AgentToolSelection[] };
export type PendingProjectAgentAction = { id: string; instruction: string; summary: string } | undefined;
export type ProjectAgentHistoryItem = { role: "user" | "assistant"; content: string };

const CONFIRM = /^(?:confirmer|confirmé|confirme|oui|vas-y|vas y|go|lance|continue|continuer|ok|d['’]?accord)$/i;
const CANCEL = /^(?:annuler|annule|non|stop|pas maintenant|plus tard)$/i;
const CHANGE = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait|rends|rend|supprime|supprimer|mets|mettre|adapte|adapter|add|modify|change|create|build|generate|fix|improve|redesign|replace|make|update)\b/i;
const HIGH_IMPACT = /\b(?:déploie|deploie|publie|publier|publication|mise en ligne|paye|payer|paiement|achat|achète|achete|supprime.{0,48}(?:données|donnees|projet|fichiers?|base)|réinitialise|reinitialise|reset|remplace.{0,48}(?:architecture|tous les fichiers?))\b/i;
const COMPLEX = /\b(?:application complète|app complète|reconstruis|architecture|système complet|systeme complet|refonte complète|refonte complete|tout le projet)\b/i;
const PAYMENT_WITHOUT_PROVIDER = /\b(?:paiement|payer|checkout|abonnement|facturation)\b/i;
const HAS_PAYMENT_PROVIDER = /\b(?:stripe|paypal|square|moncash)\b/i;
const CONTEXTUAL_REFERENCE = /\b(?:elle|celui-là|celui la|celle-là|celle la|le précédent|la précédente|comme avant)\b|\b(?:rends|change|modifie|adapte)-(?:le|la|lui)\b/i;
const ACTIONABLE_CONTEXT = /\b(?:ajoute|modifie|change|crée|cree|construis|génère|genere|corrige|améliore|ameliore|refonds|remplace|intègre|integre|supprime|mets|rends|adapte|page|bouton|section|écran|ecran|parcours|design|couleur)\b/i;

function conciseCandidate(content: string) {
  return content.replace(/\s+/g, " ").replace(/[*_`]/g, "").trim().slice(0, 140);
}

function recentContextCandidates(history: ProjectAgentHistoryItem[] = []) {
  const candidates: string[] = [];
  for (const item of [...history].reverse()) {
    if (item.role !== "user" || !ACTIONABLE_CONTEXT.test(item.content)) continue;
    const candidate = conciseCandidate(item.content);
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
    if (candidates.length === 2) break;
  }
  return candidates;
}

function createAssessment(input: {
  project: Project;
  files: BuilderFile[];
  message: string;
  history?: ProjectAgentHistoryItem[];
  clarity: AgentClarity;
  risk: AgentImpact;
}): ProjectAgentAssessment {
  const projectObjective = input.project.generatedPlan?.summary || input.project.description;
  const latestUserMessage = [...(input.history || [])].reverse().find(item => item.role === "user")?.content;
  return {
    userRequest: input.message,
    likelyReason: `Faire progresser ${input.project.name} vers ${conciseCandidate(projectObjective)}`,
    desiredOutcome: `Un résultat concret et vérifiable qui répond à : ${conciseCandidate(input.message)}`,
    projectObjective,
    currentContext: `${input.project.target === "mobile" ? "Application mobile" : "Application web"} ; ${input.files.length} fichier${input.files.length > 1 ? "s" : ""} enregistré${input.files.length > 1 ? "s" : ""}${latestUserMessage ? ` ; dernier contexte utilisateur : ${conciseCandidate(latestUserMessage)}` : ""}.`,
    constraints: [
      "Préserver les fonctionnalités existantes et les fichiers non concernés.",
      "Ne pas déclarer une publication, une intégration ou une vérification non réalisée.",
      "Demander confirmation avant toute action irréversible, paiement, publication ou suppression importante.",
    ],
    requiredActions: ["Lire le contexte enregistré", "Choisir le prochain mouvement le moins risqué"],
    clarity: input.clarity,
    risk: input.risk,
  };
}

function selectTools(decision: ProjectAgentDecisionData): AgentToolSelection[] {
  const context: AgentToolSelection = { tool: "project_context", status: "used", purpose: "Comprendre le projet, son historique, ses fichiers et ses décisions avant de choisir une action." };
  if (decision.kind === "modify") return [
    context,
    { tool: "project_files", status: "selected", purpose: "Inspecter et modifier uniquement les fichiers concernés." },
    { tool: "builder_generation", status: "selected", purpose: "Produire une modification incrémentale du projet." },
    { tool: "background_task", status: "selected", purpose: "Suivre la génération sans dépendre de la page ouverte." },
    { tool: "static_validation", status: "selected", purpose: "Vérifier les fichiers avant de les présenter comme utilisables." },
    { tool: "isolated_preview", status: "selected", purpose: "Préparer l’aperçu isolé une fois les fichiers validés." },
  ];
  if (decision.kind === "confirm" || decision.kind === "confirmed") return [context, { tool: "external_integration", status: "requires_confirmation", purpose: "Une action sensible reste bloquée tant que le parcours sécurisé et ses prérequis ne sont pas confirmés." }];
  if (decision.kind === "clarify") return [context, { tool: "external_integration", status: "requires_configuration", purpose: "Aucune intégration externe n’est activée sans le fournisseur ou la configuration indispensable." }];
  return [context];
}

function withAssessment<T extends ProjectAgentDecisionData>(decision: T, assessment: ProjectAgentAssessment): T & { assessment: ProjectAgentAssessment; tools: AgentToolSelection[] } {
  const requiredActions = decision.kind === "modify"
    ? ["Analyser les fichiers concernés", "Appliquer une modification incrémentale", "Valider les fichiers et l’aperçu"]
    : decision.kind === "plan"
      ? ["Structurer l’approche", "Présenter un résumé concis", "Attendre une demande d’exécution"]
      : decision.kind === "clarify"
        ? ["Poser une clarification critique unique", "Utiliser la réponse pour continuer"]
        : decision.kind === "confirm" || decision.kind === "confirmed"
          ? ["Conserver la décision", "Attendre ou enregistrer la confirmation explicite", "Utiliser le parcours sécurisé approprié"]
          : ["Répondre avec le contexte réel", "Conserver la continuité de la conversation"];
  return { ...decision, assessment: { ...assessment, requiredActions }, tools: selectTools(decision) };
}

function assessedInstruction(instruction: string, assessment: ProjectAgentAssessment) {
  return `${instruction}\n\nContexte interne Lakay : objectif = ${assessment.projectObjective}; état = ${assessment.currentContext}; résultat attendu = ${assessment.desiredOutcome}; contraintes = ${assessment.constraints.join(" ")}`;
}

function shortPlan(project: Project, files: BuilderFile[]) {
  const plan = project.generatedPlan;
  const firstFeature = plan?.features?.[0] || "le parcours principal";
  const secondFeature = plan?.features?.[1] || "les écrans et interactions nécessaires";
  const state = files.length ? "Je conserve la version actuelle et avance par améliorations ciblées." : "Je commence par une première version utilisable, puis nous l’améliorerons ensemble.";
  const architecture = files.length ? "J’inspecte les fichiers existants et ne change que ce qui est nécessaire." : "Je prépare une structure simple, responsive et prête à évoluer.";
  return `Voici le plan le plus utile pour **${project.name}** :

1. **Objectif et utilisateurs** — valider le parcours principal autour de **${firstFeature}**.
2. **Interface et logique** — construire ou renforcer **${secondFeature}** sans casser ce qui fonctionne.
3. **Architecture, données et intégrations** — ${architecture}
4. **Vérification** — contrôler l’aperçu, le responsive, l’action centrale et les erreurs avant la suite.
5. **Publication** — préparer uniquement les prérequis réellement nécessaires, sans mise en ligne automatique.

${state} Dites simplement **« continue »** lorsque vous voulez que je commence.`;
}

export function assessProjectAgentRequest(input: {
  project: Project;
  files: BuilderFile[];
  message: string;
  pendingAction?: PendingProjectAgentAction;
  history?: ProjectAgentHistoryItem[];
}): ProjectAgentDecision {
  const message = input.message.trim();
  const normalized = message.replace(/[.!…]+$/g, "").trim();
  const contextualCandidates = recentContextCandidates(input.history);
  const likelyRisk: AgentImpact = HIGH_IMPACT.test(message) ? "high" : CHANGE.test(message) || CONTEXTUAL_REFERENCE.test(message) ? "moderate" : "safe";
  const likelyClarity: AgentClarity = COMPLEX.test(message) ? "complex" : CONTEXTUAL_REFERENCE.test(message) && contextualCandidates.length !== 1 ? "ambiguous" : "sufficient";
  const assessment = createAssessment({ project: input.project, files: input.files, message, history: input.history, clarity: likelyClarity, risk: likelyRisk });

  if (input.pendingAction && CANCEL.test(normalized)) return withAssessment({ kind: "cancelled", impact: "safe", actionId: input.pendingAction.id, answer: "Très bien, cette action est annulée. Votre projet n’a pas été modifié." }, { ...assessment, clarity: "clear", risk: "safe" });
  if (input.pendingAction && CONFIRM.test(normalized)) return withAssessment({ kind: "confirmed", impact: "high", actionId: input.pendingAction.id, instruction: input.pendingAction.instruction, answer: `Confirmation enregistrée pour : **${input.pendingAction.summary}**. Cette décision est conservée ; Lakay ne remplace pas des fichiers, ne supprime pas de données et ne publie rien automatiquement sans le parcours sécurisé correspondant.` }, { ...assessment, clarity: "clear", risk: "high" });
  if (PAYMENT_WITHOUT_PROVIDER.test(message) && !HAS_PAYMENT_PROVIDER.test(message)) return withAssessment({ kind: "clarify", impact: "safe", answer: "Quel moyen de paiement voulez-vous utiliser : **Stripe**, **PayPal** ou un autre service ? Je préparerai ensuite le parcours adapté, sans activer de paiement réel avant votre confirmation." }, { ...assessment, clarity: "critical_missing", risk: "safe" });
  if (HIGH_IMPACT.test(message)) {
    const summary = conciseCandidate(message).slice(0, 260);
    return withAssessment({ kind: "confirm", impact: "high", instruction: message, summary, answer: `Cette action peut modifier durablement la publication, les données ou l’architecture du projet. Je suis prêt à : **${summary}**.

Répondez **« Confirmer »** pour la lancer, ou **« Annuler »** pour conserver l’état actuel.` }, { ...assessment, clarity: "clear", risk: "high" });
  }
  if (COMPLEX.test(message)) return withAssessment({ kind: "plan", impact: "safe", answer: shortPlan(input.project, input.files) }, { ...assessment, clarity: "complex", risk: "safe" });
  if (CONTEXTUAL_REFERENCE.test(message)) {
    if (contextualCandidates.length === 1) return withAssessment({ kind: "modify", impact: "moderate", instruction: assessedInstruction(`${message}\n\nContexte auquel cette demande fait référence : ${contextualCandidates[0]}. Conserve le sens de cette demande précédente et applique uniquement l’amélioration actuelle.`, { ...assessment, clarity: "clear", risk: "moderate" }) }, { ...assessment, clarity: "clear", risk: "moderate" });
    if (contextualCandidates.length > 1) return withAssessment({ kind: "clarify", impact: "safe", answer: `Je peux le faire. Tu parles de **${contextualCandidates[0]}** ou de **${contextualCandidates[1]}** ?` }, { ...assessment, clarity: "ambiguous", risk: "safe" });
    return withAssessment({ kind: "clarify", impact: "safe", answer: "Je peux l’améliorer. Quel élément précis veux-tu reprendre : la page, le bouton ou le parcours concerné ?" }, { ...assessment, clarity: "ambiguous", risk: "safe" });
  }
  if (CHANGE.test(message)) return withAssessment({ kind: "modify", impact: "moderate", instruction: assessedInstruction(message, { ...assessment, clarity: "clear", risk: "moderate" }) }, { ...assessment, clarity: "clear", risk: "moderate" });
  return withAssessment({ kind: "conversation", impact: "safe" }, { ...assessment, clarity: "sufficient", risk: "safe" });
}
