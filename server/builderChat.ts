import type { Project } from "../drizzle/schema";
import type { BuilderFile } from "../shared/builder";
import type { InvokeParams } from "./_core/llm";
import { invokeLakayWithFallback } from "./projectPlanning";
import { GeminiProviderError } from "./gemini";

export type BuilderChatIntent = "conversation" | "build";

const CHANGE_REQUEST = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|supprime|supprimer|mets|mettre|adapte|adapter|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait)\b/i;
const QUESTION_REQUEST = /\?|^(?:que|quoi|comment|pourquoi|où|ou|quand|peux-tu|peut tu|dis-moi|dis moi|explique|montre-moi|montre moi|résume|resume|il reste)\b/i;
const ACKNOWLEDGEMENT = /^(?:merci|top|génial|genial|excellent|cool)$/i;
const CONTINUATION_REQUEST = /^(?:parfait|super|ok|okay|d['’]?accord|très bien|tres bien|c['’]?est bon|oui|sounds good|au boulot|au travail|continuer|continue|vas-y|vas y|go|on y va|fais-le|fais le|lance|poursuis)$/i;

export function classifyBuilderChatIntent(message: string): BuilderChatIntent {
  const trimmed = message.trim();
  if (CONTINUATION_REQUEST.test(trimmed.replace(/[.!…]+$/g, ""))) return "build";
  if (QUESTION_REQUEST.test(trimmed)) return "conversation";
  return CHANGE_REQUEST.test(trimmed) ? "build" : "conversation";
}

function isProjectProgressQuestion(message: string) {
  return /(reste|restant|priorit|propos|sugg|amélior|amelior|prochain|étape|suite|terminer|finir)/i.test(message);
}

function plannedNextSteps(project: Project) {
  const plan = project.generatedPlan;
  if (!plan) return ["tester le parcours principal dans l’aperçu", "choisir une amélioration concrète à traiter ensuite"];
  const candidates = [...plan.features, ...plan.goals].map(item => item.replace(/\s+/g, " ").trim()).filter(Boolean);
  return candidates.slice(0, 2).length ? candidates.slice(0, 2) : ["tester le parcours principal dans l’aperçu", "choisir une amélioration concrète à traiter ensuite"];
}

function isShortAcknowledgement(message: string) {
  return ACKNOWLEDGEMENT.test(message.trim().replace(/[.!…]+$/g, ""));
}

export function isContinuationRequest(message: string) {
  return CONTINUATION_REQUEST.test(message.trim().replace(/[.!…]+$/g, ""));
}

function recommendedStepFromHistory(history: Array<{ role: "user" | "assistant"; content: string }> = []) {
  const previousAssistant = [...history].reverse().find(item => item.role === "assistant");
  const match = previousAssistant?.content.match(/(?:^|\n)\s*1\.\s*([^\n]+)/);
  return match?.[1]?.replace(/[*_`]/g, "").trim() || null;
}

export function createContinuationBuilderAction({ project, files, message, history }: { project: Project; files: BuilderFile[]; message: string; history?: Array<{ role: "user" | "assistant"; content: string }> }) {
  if (!isContinuationRequest(message)) return null;
  const steps = plannedNextSteps(project);
  const selectedStep = recommendedStepFromHistory(history) || steps[0];
  const hasV1 = files.length > 0;
  return {
    instruction: `Applique maintenant l’amélioration prioritaire suivante à ${project.name} : ${selectedStep}. Conserve ce qui fonctionne déjà, améliore le parcours principal de façon visible, et vérifie que l’interface reste responsive et cohérente.`,
    acknowledgement: `Très bien. Je passe à l’action sur **${selectedStep}**. ${hasV1 ? "Je conserve la V1 actuelle et je renforce cette partie sans disperser le projet." : "Je crée cette première amélioration dans la V1."} Je vous montrerai le résultat dans l’aperçu dès que la modification sera prête.`,
  };
}

export function createImmediateBuilderAcknowledgement({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  if (!isShortAcknowledgement(message)) return null;
  const steps = plannedNextSteps(project);
  const currentState = files.length
    ? `La V1 de **${project.name}** est bien conservée dans ${files.length} fichiers.`
    : `Le projet **${project.name}** est prêt à recevoir sa première version.`;
  return `Parfait. ${currentState}

Je garde la direction actuelle et je vous propose de renforcer en priorité :
1. ${steps[0]}
2. ${steps[1] || "le parcours principal et ses états utiles"}

Vous pouvez me répondre naturellement, par exemple : **« analyse ce qui manque »**, **« propose la meilleure V2 »** ou **« ajoute la première amélioration »**.

Je n’ai appliqué aucune modification avec cette confirmation.`;
}

export function createImmediateProjectProgressReply({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  if (!isProjectProgressQuestion(message)) return null;
  const plan = project.generatedPlan;
  const steps = plannedNextSteps(project);
  const sourceState = files.length
    ? `Une V1 est déjà enregistrée dans ${files.length} fichiers et peut être vérifiée dans l’aperçu.`
    : "La V1 n’est pas encore enregistrée ; la priorité est de terminer la première génération.";
  const planContext = plan?.summary ? `Le plan vise : ${plan.summary.replace(/\s+/g, " ").trim().slice(0, 220)}.` : "Le plan détaillé n’est pas disponible, donc je m’appuie sur les fichiers actuels.";
  return `Voici le point le plus utile tout de suite pour **${project.name}** :

**Déjà prêt**
${sourceState}

**À vérifier maintenant**
Testez le parcours principal comme un vrai utilisateur : ouvrez l’aperçu, faites l’action centrale, puis repérez le premier moment qui paraît confus ou incomplet.

**Je vous propose ensuite**
1. ${steps[0]}
2. ${steps[1] || "affiner le style et les textes du parcours principal"}

${planContext}

Cette réponse s’appuie sur l’état enregistré du projet. Votre application n’a pas été modifiée.`;
}

export function createLocalBuilderFallbackReply({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  const acknowledgementReply = createImmediateBuilderAcknowledgement({ project, files, message });
  if (acknowledgementReply) return acknowledgementReply;
  const immediateReply = createImmediateProjectProgressReply({ project, files, message });
  if (immediateReply) return immediateReply;
  const steps = plannedNextSteps(project);
  const sourceSummary = files.length > 0 ? `La V1 est enregistrée dans ${files.length} fichiers.` : "La V1 reste à finaliser.";
  const planContext = project.generatedPlan?.summary ? `Le produit vise : ${project.generatedPlan.summary.replace(/\s+/g, " ").trim().slice(0, 180)}.` : "Le plan détaillé n’est pas disponible, donc je m’appuie sur l’état actuel du projet.";
  return `Pour faire avancer **${project.name}**, voici la décision la plus utile : ${sourceSummary}

${planContext}

**Recommandation prioritaire**
Consolider d’abord **${steps[0]}** : c’est le meilleur moyen d’améliorer l’expérience sans disperser le projet.

Ensuite, je vous suggère **${steps[1] || "tester le parcours principal avec un regard neuf"}**.

	Vous pouvez me demander d’analyser un écran, de proposer une V2 ou d’appliquer cette amélioration. Aucune modification n’a été appliquée avec cette réponse.`;
}

export function isCompleteConversationalReply(content: string, finishReason: string | null | undefined) {
  if (finishReason && finishReason !== "stop") return false;
  const trimmed = content.trim();
  return trimmed.length >= 32 && /[.!?…]["'»”)]*$/.test(trimmed);
}

export async function createBuilderConversationReply({
  project,
  files,
  history,
  message,
}: {
  project: Project;
  files: BuilderFile[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}) {
  const fileOutline = files.length
    ? files.slice(0, 8).map(file => `${file.path} (${file.content.length} caractères)`).join(", ")
    : "Aucun fichier généré pour le moment";
  const planSummary = project.generatedPlan ? `${project.generatedPlan.summary} · Fonctionnalités : ${project.generatedPlan.features.slice(0, 5).join(", ")}` : "Plan initial indisponible.";
  const recentHistory = history.slice(-12).map(item => `${item.role === "user" ? "Utilisateur" : "Lakay"} : ${item.content.replace(/\s+/g, " ").slice(0, 300)}`).join("\n") || "Aucun";
  const request: Omit<InvokeParams, "model"> & { preferGemini: true; geminiRoute: "followup" } = {
    preferGemini: true,
    geminiRoute: "followup",
    messages: [
      {
        role: "system",
        content: `Tu es Lakay, un copilote produit senior et autonome dans un espace de création d’application. Réponds en français avec le jugement, la clarté et la proactivité d’un excellent développeur et product designer qui connaît déjà le projet.

Règles strictes de continuité : utilise d’abord l’historique récent, le plan et les fichiers. Ne répète jamais l’accueil, le diagnostic initial, ni une recommandation déjà donnée sauf si l’utilisateur le demande. Réponds directement à l’intention actuelle ; n’ajoute pas de préambule générique. Les validations brèves et les demandes d’exécution sont déjà routées vers le moteur de modification : ne les transforme jamais en question ou en nouveau plan.

Quand l’utilisateur pose une question, fonde ton analyse sur les faits du projet : parcours, fonctionnalités, fichiers et modifications récentes. Si quelque chose « ne marche pas », formule la cause probable, l’impact, puis la correction la plus précise à appliquer — sans support générique ni théorie vide. Si la demande est vague, choisis une hypothèse raisonnable et propose au plus deux options actionnables. Ne prétends jamais avoir modifié du code dans ce mode conversationnel, ne fournis pas de code brut, et ne parle jamais de délais, modèles, jetons ou crédits. Reste direct, humain et concis : 160 mots maximum.`,
      },
      {
        role: "user",
        content: `Projet : ${project.name}
Description : ${project.description}
Plan : ${planSummary}
Fichiers actuels : ${fileOutline}
Historique récent : ${recentHistory}

Question de l’utilisateur : ${message}`,
      },
    ],
    max_tokens: 520,
  };
  const response = await invokeLakayWithFallback(request);
  const content = response.choices[0]?.message.content;
  if (typeof content === "string" && isCompleteConversationalReply(content, response.choices[0]?.finish_reason)) {
    return { content: content.trim(), model: response.model, usage: response.usage };
  }

  const repair = await invokeLakayWithFallback({
    ...request,
    messages: [...request.messages, { role: "user" as const, content: "Ta réponse précédente était incomplète. Réponds maintenant en une explication complète, directe et terminée par une phrase claire. Ne mentionne pas cette correction." }],
    max_tokens: 360,
  });
  const repairedContent = repair.choices[0]?.message.content;
  if (typeof repairedContent === "string" && isCompleteConversationalReply(repairedContent, repair.choices[0]?.finish_reason)) {
    return { content: repairedContent.trim(), model: repair.model, usage: repair.usage };
  }
  throw new GeminiProviderError(502, "Lakay received an incomplete conversational response and did not store it.");
}
