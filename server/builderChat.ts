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
    ? files.map(file => `${file.path} (${file.content.length} caractères)`).join(", ")
    : "Aucun fichier généré pour le moment";
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
Plan : ${JSON.stringify(project.generatedPlan)}
Fichiers actuels : ${fileOutline}
Historique récent : ${history.slice(-8).map(item => `${item.role === "user" ? "Utilisateur" : "Lakay"} : ${item.content}`).join("\n") || "Aucun"}

Question de l’utilisateur : ${message}`,
      },
    ],
    max_tokens: 900,
  });
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("Lakay n’a pas pu formuler de réponse utile.");
  return { content: content.trim(), model: response.model, usage: response.usage };
}
