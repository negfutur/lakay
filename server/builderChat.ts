import type { Project } from "../drizzle/schema";
import type { BuilderFile } from "../shared/builder";
import { invokeLakayWithFallback } from "./projectPlanning";

export type BuilderChatIntent = "conversation" | "build";

const CHANGE_REQUEST = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|supprime|supprimer|mets|mettre|adapte|adapter|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait)\b/i;
const QUESTION_REQUEST = /\?|^(?:que|quoi|comment|pourquoi|où|ou|quand|peux-tu|peut tu|dis-moi|dis moi|explique|montre-moi|montre moi|résume|resume|il reste)\b/i;

export function classifyBuilderChatIntent(message: string): BuilderChatIntent {
  const trimmed = message.trim();
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
  const immediateReply = createImmediateProjectProgressReply({ project, files, message });
  if (immediateReply) return `${immediateReply}\n\nLa réponse approfondie a dépassé le délai normal, mais ce point d’avancement reste disponible immédiatement.`;
  const question = message.trim().toLowerCase();
  const sourceSummary = files.length > 0 ? `${files.length} fichiers de l’application sont déjà enregistrés` : "la première version n’est pas encore enregistrée";
  if (/(reste|priorit|amélior|amelior|prochain)/i.test(question)) {
    return `La réponse détaillée a dépassé le délai normal. ${sourceSummary}. Votre application n’a pas été modifiée. La prochaine étape est de réessayer dans un instant ou de demander directement l’amélioration la plus importante à ajouter.`;
  }
  if (/(fait|modifi|changé|change|résume|resume)/i.test(question)) {
    return `${sourceSummary} pour **${project.name}**. La réponse détaillée a dépassé le délai normal, mais aucune modification n’a été appliquée. Vous pouvez réessayer votre question dans un instant ou demander une amélioration précise.`;
  }
  return `La réponse détaillée a dépassé le délai normal. Je peux toutefois confirmer que ${sourceSummary} pour **${project.name}** et que votre application n’a pas été modifiée. Réessayez votre question dans un instant ou décrivez directement la prochaine amélioration souhaitée.`;
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
  const recentHistory = history.slice(-6).map(item => `${item.role === "user" ? "Utilisateur" : "Lakay"} : ${item.content.replace(/\s+/g, " ").slice(0, 360)}`).join("\n") || "Aucun";
  const response = await invokeLakayWithFallback({
    preferGemini: true,
    geminiRoute: "followup",
    messages: [
      {
        role: "system",
        content: `Tu es Lakay, le copilote produit dans un espace de création d’application. Réponds en français, avec naturel et précision, comme un partenaire de conception attentif.

L’utilisateur pose une question ou souhaite discuter : tu ne dois pas modifier les fichiers, ne prétends jamais avoir codé, et ne fournis pas de code. Réponds directement à la question à partir du projet. Si la demande est vague, propose au plus deux pistes concrètes. Reste concis (maximum 130 mots), sans jargon d’infrastructure, sans parler de modèles, de jetons ou de crédits. Quand c’est utile, précise clairement ce qui existe déjà, ce qui manque, et la prochaine action recommandée.`,
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
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Lakay n’a pas pu formuler de réponse utile.");
  return { content: content.trim(), model: response.model, usage: response.usage };
}
