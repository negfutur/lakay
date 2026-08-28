import type { Project } from "../drizzle/schema";
import type { BuilderFile, BuilderVersion } from "../shared/builder";
import type { InvokeParams } from "./_core/llm";
import { invokeLakayProvider } from "./aiProvider";
import { GeminiProviderError } from "./gemini";
import { createBuildProjectContext } from "./projectBuildContext";

export type BuilderChatIntent = "conversation" | "build";

const CHANGE_REQUEST = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|supprime|supprimer|mets|mettre|adapte|adapter|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait)\b/i;
const QUESTION_REQUEST = /\?|^(?:que|quoi|comment|pourquoi|où|ou|quand|peux-tu|peut tu|dis-moi|dis moi|explique|montre-moi|montre moi|résume|resume|il reste)\b/i;
const DIAGNOSTIC_REQUEST = /\b(?:diagnos\w*|analys\w*|examin\w*|vérifi\w*|verifi\w*)\b/i;
const ISSUE_REQUEST = /(?:ça|cela|ca|ceci).{0,24}(?:ne marche pas|ne fonctionne pas|est cassé)|\b(?:bug|erreur|problème|probleme|cassé|cassée|broken)\b/i;
const ACKNOWLEDGEMENT = /^(?:merci|top|génial|genial|excellent|cool)$/i;
const CONTINUATION_REQUEST = /^(?:parfait|super|ok|okay|d['’]?accord|très bien|tres bien|c['’]?est bon|oui|sounds good|au boulot|au travail|continuer|continue|vas-y|vas y|go|on y va|fais-le|fais le|lance|poursuis)$/i;

export function classifyBuilderChatIntent(message: string): BuilderChatIntent {
  const trimmed = message.trim();
  if (CONTINUATION_REQUEST.test(trimmed.replace(/[.!…]+$/g, ""))) return "build";
  if (QUESTION_REQUEST.test(trimmed)) return "conversation";
  if (DIAGNOSTIC_REQUEST.test(trimmed)) return "conversation";
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

function compactConversationHistory(history: Array<{ role: "user" | "assistant"; content: string }>) {
  return history.slice(-12).map((item, index) => `${index + 1}. ${item.role === "user" ? "Utilisateur" : "Lakay"} : ${item.content.replace(/\s+/g, " ").slice(0, 900)}`).join("\n") || "Aucun";
}

function compactProjectFileContext(files: BuilderFile[]) {
  if (!files.length) return "Aucun fichier généré pour le moment.";
  return files.slice(0, 16).map(file => {
    const preview = file.content.replace(/\s+/g, " ").slice(0, 420);
    return `• ${file.path} (${file.language}, ${file.content.length} caractères)${preview ? ` : ${preview}` : ""}`;
  }).join("\n");
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
  const currentState = files.length
    ? `La V1 de **${project.name}** est bien conservée dans ${files.length} fichiers.`
    : `Le projet **${project.name}** est prêt à recevoir sa première version.`;
  return `Parfait. ${currentState} Dites-moi directement ce que vous voulez comprendre ou améliorer ; je répondrai sur ce point sans répéter le plan.`;
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
  const planContext = plan?.summary ? `Objectif : ${plan.summary.replace(/\s+/g, " ").trim().slice(0, 180)}.` : "L’objectif détaillé reste à préciser.";
  return `**État de ${project.name}**

${sourceState}

**Prochaine priorité :** ${steps[0]}.

${planContext}

Je n’ai modifié aucun fichier.`;
}

export function createLocalBuilderFallbackReply({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  const clarificationReply = createImmediateVersionClarificationReply({ project, files, message });
  if (clarificationReply) return clarificationReply;
  if (DIAGNOSTIC_REQUEST.test(message)) {
    const projectState = files.length
      ? `La version actuelle est enregistrée dans ${files.length} fichiers.`
      : "Aucune version utilisable n’est encore enregistrée.";
    return `**Diagnostic de ${project.name}**

${projectState} La prochaine vérification utile est le parcours principal dans l’aperçu : ouvrez-le, testez l’action centrale, puis indiquez-moi le premier blocage précis. Lakay pourra alors appliquer la correction correspondante.`;
  }
  const projectState = files.length ? "La version actuelle est conservée." : "La première version reste à créer.";
  return `Je n’ai pas pu terminer l’analyse de cette demande. ${projectState} Réessayez votre question ou décrivez directement le changement que vous voulez appliquer.`;
}

export function createImmediateDiagnosticReply({ project, files, message }: { project: Project; files: BuilderFile[]; message: string }) {
  if (!DIAGNOSTIC_REQUEST.test(message)) return null;
  const state = files.length
    ? `La version actuelle contient ${files.length} fichiers enregistrés et peut être contrôlée dans l’aperçu.`
    : "Aucune version utilisable n’est encore enregistrée pour ce projet.";
  const nextStep = plannedNextSteps(project)[0];
  return `**Diagnostic de ${project.name}**

${state}

**Point à contrôler :** ${nextStep}. Ouvrez l’aperçu et testez l’action principale. Si un écran est vide ou qu’une action ne répond pas, décrivez exactement le geste et le résultat : Lakay préparera la correction ciblée.`;
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
  const codeContext = compactProjectFileContext(files);
  const planSummary = project.generatedPlan ? `${project.generatedPlan.summary} · Fonctionnalités : ${project.generatedPlan.features.slice(0, 5).join(", ")}` : "Plan initial indisponible.";
  const recentHistory = compactConversationHistory(history);
  const request: Omit<InvokeParams, "model"> = {
    messages: [
      {
        role: "system",
        content: `Tu es Lakay, un copilote produit senior dans un espace de création d’application. Réponds en français, avec le jugement clair d’un développeur et product designer qui connaît le projet.

Réponds d’abord à l’intention précise de l’utilisateur. Donne un résultat concret, pas un plan générique. N’écris ni accueil, ni diagnostic générique, ni explication répétée. N’annonce pas des actions non réalisées. Les validations et demandes de modification sont gérées ailleurs : ne les transforme pas en nouveau plan.

Pour une question produit : formule une réponse directe, puis une recommandation prioritaire si elle apporte une valeur réelle. Pour un problème : indique la cause la plus probable, l’impact, puis la correction ciblée. Pour une demande vague, choisis l’hypothèse la plus raisonnable et propose au plus deux choix. Utilise les faits fournis ; si le contexte ne suffit pas, dis-le clairement. Ne parle jamais de modèles, de jetons, de crédits ou de délais. Pas de code brut. Réponse courte, naturelle et utile : 180 mots maximum.`,
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
    return { content: content.trim(), model: response.model, provider: response.lakayProvider, usage: response.usage };
  }

  const repair = await invokeLakayProvider({
    ...request,
    messages: [...request.messages, { role: "user" as const, content: "Ta réponse précédente était incomplète. Réponds maintenant en une explication complète, directe et terminée par une phrase claire. Ne mentionne pas cette correction." }],
    max_tokens: 700,
  }, { task: "conversation" });
  const repairedContent = repair.choices[0]?.message.content;
  if (typeof repairedContent === "string" && isCompleteConversationalReply(repairedContent, repair.choices[0]?.finish_reason)) {
    return { content: repairedContent.trim(), model: repair.model, provider: repair.lakayProvider, usage: repair.usage };
  }
  throw new GeminiProviderError(502, "Lakay received an incomplete conversational response and did not store it.");
}
