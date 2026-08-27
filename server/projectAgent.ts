import type { Project } from "../drizzle/schema";
import type { BuilderFile } from "../shared/builder";

export type AgentImpact = "safe" | "moderate" | "high";
export type ProjectAgentDecision =
  | { kind: "conversation"; impact: "safe" }
  | { kind: "clarify"; impact: "safe"; answer: string }
  | { kind: "plan"; impact: "safe"; answer: string }
  | { kind: "modify"; impact: "moderate"; instruction: string }
  | { kind: "confirm"; impact: "high"; instruction: string; summary: string; answer: string }
  | { kind: "confirmed"; impact: "high"; actionId: string; instruction: string; answer: string }
  | { kind: "cancelled"; impact: "safe"; actionId: string; answer: string };

export type PendingProjectAgentAction = {
  id: string;
  instruction: string;
  summary: string;
} | undefined;

const CONFIRM = /^(?:confirmer|confirmé|confirme|oui|vas-y|vas y|go|lance|continue|continuer|ok|d['’]?accord)$/i;
const CANCEL = /^(?:annuler|annule|non|stop|pas maintenant|plus tard)$/i;
const CHANGE = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait|supprime|supprimer|mets|mettre|adapte|adapter)\b/i;
const HIGH_IMPACT = /\b(?:déploie|deploie|publie|publier|publication|mise en ligne|paye|payer|paiement|achat|achète|achete|supprime.{0,48}(?:données|donnees|projet|fichiers?|base)|réinitialise|reinitialise|reset|remplace.{0,48}(?:architecture|tous les fichiers?))\b/i;
const COMPLEX = /\b(?:application complète|app complète|reconstruis|architecture|système complet|systeme complet|refonte complète|refonte complete|tout le projet)\b/i;
const PAYMENT_WITHOUT_PROVIDER = /\b(?:paiement|payer|checkout|abonnement|facturation)\b/i;
const HAS_PAYMENT_PROVIDER = /\b(?:stripe|paypal|square|moncash)\b/i;

function shortPlan(project: Project, files: BuilderFile[]) {
  const plan = project.generatedPlan;
  const firstFeature = plan?.features?.[0] || "le parcours principal";
  const secondFeature = plan?.features?.[1] || "les écrans et interactions nécessaires";
  const state = files.length ? "Je conserve la version actuelle et avance par améliorations ciblées." : "Je commence par une première version utilisable, puis nous l’améliorerons ensemble.";
  return `Voici le plan le plus utile pour **${project.name}** :

1. Clarifier le parcours principal autour de **${firstFeature}**.
2. Construire ou renforcer **${secondFeature}** sans casser ce qui fonctionne.
3. Vérifier l’aperçu, le responsive et l’action centrale avant la suite.

${state} Dites simplement **« continue »** lorsque vous voulez que je commence.`;
}

export function assessProjectAgentRequest(input: {
  project: Project;
  files: BuilderFile[];
  message: string;
  pendingAction?: PendingProjectAgentAction;
}): ProjectAgentDecision {
  const message = input.message.trim();
  const normalized = message.replace(/[.!…]+$/g, "").trim();

  if (input.pendingAction && CANCEL.test(normalized)) {
    return { kind: "cancelled", impact: "safe", actionId: input.pendingAction.id, answer: "Très bien, cette action est annulée. Votre projet n’a pas été modifié." };
  }
  if (input.pendingAction && CONFIRM.test(normalized)) {
    return { kind: "confirmed", impact: "high", actionId: input.pendingAction.id, instruction: input.pendingAction.instruction, answer: `Confirmation enregistrée pour : **${input.pendingAction.summary}**. Cette décision est conservée ; Lakay ne remplace pas des fichiers, ne supprime pas de données et ne publie rien automatiquement sans le parcours sécurisé correspondant.` };
  }
  if (PAYMENT_WITHOUT_PROVIDER.test(message) && !HAS_PAYMENT_PROVIDER.test(message)) {
    return { kind: "clarify", impact: "safe", answer: "Quel moyen de paiement voulez-vous utiliser : **Stripe**, **PayPal** ou un autre service ? Je préparerai ensuite le parcours adapté, sans activer de paiement réel avant votre confirmation." };
  }
  if (HIGH_IMPACT.test(message)) {
    const summary = message.replace(/\s+/g, " ").trim().slice(0, 260);
    return { kind: "confirm", impact: "high", instruction: message, summary, answer: `Cette action peut modifier durablement la publication, les données ou l’architecture du projet. Je suis prêt à : **${summary}**.

Répondez **« Confirmer »** pour la lancer, ou **« Annuler »** pour conserver l’état actuel.` };
  }
  if (COMPLEX.test(message)) return { kind: "plan", impact: "safe", answer: shortPlan(input.project, input.files) };
  if (CHANGE.test(message)) return { kind: "modify", impact: "moderate", instruction: message };
  return { kind: "conversation", impact: "safe" };
}
