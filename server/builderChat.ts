import type { Project } from "../drizzle/schema";
import type { BuilderFile, BuilderVersion } from "../shared/builder";
import type { InvokeParams } from "./_core/llm";
import { invokeLakayProvider } from "./aiProvider";
import { GeminiProviderError } from "./gemini";
import { createBuildProjectContext } from "./projectBuildContext";

export type BuilderChatIntent = "conversation" | "build";

const CHANGE_REQUEST = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|supprime|supprimer|mets|mettre|adapte|adapter|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait)\b/i;
const QUESTION_REQUEST = /\?|^(?:que|quoi|comment|pourquoi|où|ou|quand|peux-tu|peut tu|dis-moi|dis moi|explique|montre-moi|montre moi|résume|resume|il reste)\b/i;
const ISSUE_REQUEST = /(?:ça|cela|ca|ceci).{0,24}(?:ne marche pas|ne fonctionne pas|est cassé)|\b(?:bug|erreur|problème|probleme|cassé|cassée|broken)\b/i;
const ACKNOWLEDGEMENT = /^(?:merci|top|génial|genial|excellent|cool)$/i;
const CONTINUATION_REQUEST = /^(?:parfait|super|ok|okay|d['’]?accord|très bien|tres bien|c['’]?est bon|oui|sounds good|au boulot|au travail|continuer|continue|vas-y|vas y|go|on y va|fais-le|fais le|lance|poursuis)$/i;

export function classifyBuilderChatIntent(message: string): BuilderChatIntent {
  const trimmed = message.trim();
  if (CONTINUATION_REQUEST.test(trimmed.replace(/[.!…]+$/g, ""))) return "build";
  if (QUESTION_REQUEST.test(trimmed)) return "conversation";
  if (ISSUE_REQUEST.test(trimmed)) return "build";
  return CHANGE_REQUEST.test(trimmed) ? "build" : "conversation";
}

function isProjectProgressQuestion(message: string) {
  return /(reste|restant|priorit|propos|sugg|amélior|amelior|prochain|étape|suite|terminer|finir)/i.test(message);
}

function isVersionClarificationQuestion(message: string) {
  const normalized = message.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ").trim();
  return /(?:c'?est|quest|qu'?est|quoi).{0,32}\b(?:v1|v2|version 1|version 2|mvp)\b/i.test(normalized)
    || /\b(?:v1|v2|version 1|version 2)\b.{0,20}(?:c'?est|quoi|signifie)/i.test(normalized);
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

export function createImmediateVersionClarificationReply({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  if (!isVersionClarificationQuestion(message)) return null;
  const steps = plannedNextSteps(project);
  const v1State = files.length
    ? `Pour **${project.name}**, la V1 est la version déjà construite et enregistrée dans ${files.length} fichiers. Elle doit déjà permettre de tester le parcours principal dans l’aperçu.`
    : `Pour **${project.name}**, la V1 est la première version utilisable que Lakay construit pour valider l’idée et le parcours principal.`;
  return `**V1** = la première version utilisable. Elle contient l’essentiel pour que vous puissiez tester l’idée avec de vrais écrans et actions.

**V2** = l’amélioration suivante, après vos retours. Elle ajoute ce qui rend le produit plus complet, sans refaire la V1.

${v1State}

Pour la V2, je prioriserais : **${steps[0]}**. Vous pouvez dire simplement : **« applique cette V2 »**.`;
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
  const clarificationReply = createImmediateVersionClarificationReply({ project, files, message });
  if (clarificationReply) return clarificationReply;
  const projectState = files.length ? "La version actuelle est conservée." : "La première version reste à créer.";
  return `Je n’ai pas pu terminer l’analyse de cette demande. ${projectState} Réessayez votre question ou décrivez directement le changement que vous voulez appliquer.`;
}

export function isCompleteConversationalReply(content: string, finishReason: string | null | undefined) {
  if (finishReason && finishReason !== "stop") return false;
  const trimmed = content.trim();
  return trimmed.length >= 32 && /[.!?…]["'»”)]*$/.test(trimmed);
}

export async function createBuilderConversationReply({
  project,
  files,
  versions = [],
  history,
  message,
}: {
  project: Project;
  files: BuilderFile[];
  versions?: BuilderVersion[];
  history: Array<{ role: "user" | "assistant"; content: string }>;
  message: string;
}) {
  const projectContext = createBuildProjectContext(files, versions);
  const codeContext = files.length
    ? files.map(file => `--- ${file.path} (${file.language}) ---\n${file.content}`).join("\n\n").slice(0, 48_000)
    : "Aucun fichier généré pour le moment";
  const planSummary = project.generatedPlan ? `${project.generatedPlan.summary} · Fonctionnalités : ${project.generatedPlan.features.slice(0, 5).join(", ")}` : "Plan initial indisponible.";
  const recentHistory = history.map((item, index) => `${index + 1}. ${item.role === "user" ? "Utilisateur" : "Lakay"} : ${item.content.replace(/\s+/g, " ")}`).join("\n") || "Aucun";
  const request: Omit<InvokeParams, "model"> & { preferGemini: true; geminiRoute: "followup" } = {
    preferGemini: true,
    geminiRoute: "followup",
    messages: [
      {
        role: "system",
        content: `Tu es Lakay, un copilote produit senior et autonome dans un espace de création d’application. Réponds en français avec le jugement, la clarté et la proactivité d’un excellent développeur et product designer qui connaît déjà le projet.

Règles strictes de continuité : utilise l’historique complet, le plan, les versions et le code fourni. Ne répète jamais l’accueil, le diagnostic initial, ni une recommandation déjà donnée sauf si l’utilisateur le demande. Réponds directement à l’intention actuelle ; n’ajoute pas de préambule générique. Les validations brèves et les demandes d’exécution sont déjà routées vers le moteur de modification : ne les transforme jamais en question ou en nouveau plan.

Quand l’utilisateur pose une question, réponds d’abord exactement à sa question, avec des mots simples et des faits du projet. Pour une définition, donne une définition directe avant toute recommandation. Si quelque chose « ne marche pas », formule la cause probable, l’impact, puis la correction la plus précise à appliquer — sans support générique ni théorie vide. Si la demande est vague, choisis une hypothèse raisonnable et propose au plus deux options actionnables. Ne prétends jamais avoir modifié du code dans ce mode conversationnel, ne fournis pas de code brut, et ne parle jamais de délais, modèles, jetons ou crédits. Reste direct, humain et concis : 160 mots maximum.`,
      },
      {
        role: "user",
        content: `Projet : ${project.name}
Description : ${project.description}
Plan : ${planSummary}
État de construction : ${JSON.stringify(projectContext)}
Code actuel :
${codeContext}

Historique complet : ${recentHistory}

Question de l’utilisateur : ${message}`,
      },
    ],
    max_tokens: 1_200,
  };
  const response = await invokeLakayProvider(request, { task: "conversation" });
  const content = response.choices[0]?.message.content;
  if (typeof content === "string" && isCompleteConversationalReply(content, response.choices[0]?.finish_reason)) {
    return { content: content.trim(), model: response.model, usage: response.usage };
  }

  const repair = await invokeLakayProvider({
    ...request,
    messages: [...request.messages, { role: "user" as const, content: "Ta réponse précédente était incomplète. Réponds maintenant en une explication complète, directe et terminée par une phrase claire. Ne mentionne pas cette correction." }],
    max_tokens: 700,
  }, { task: "conversation" });
  const repairedContent = repair.choices[0]?.message.content;
  if (typeof repairedContent === "string" && isCompleteConversationalReply(repairedContent, repair.choices[0]?.finish_reason)) {
    return { content: repairedContent.trim(), model: repair.model, usage: repair.usage };
  }
  throw new GeminiProviderError(502, "Lakay received an incomplete conversational response and did not store it.");
}
