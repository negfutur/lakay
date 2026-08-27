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

export type ProjectAgentHistoryItem = { role: "user" | "assistant"; content: string };

const CONFIRM = /^(?:confirmer|confirmé|confirme|oui|vas-y|vas y|go|lance|continue|continuer|ok|d['’]?accord)$/i;
const CANCEL = /^(?:annuler|annule|non|stop|pas maintenant|plus tard)$/i;
const CHANGE = /^(?:ajoute|ajouter|modifie|modifier|change|changer|crée|cree|créer|construis|construire|génère|genere|générer|corrige|corriger|améliore|ameliore|améliorer|refonds|remplace|intègre|integre|intégrer|fais|fait|rends|rend|supprime|supprimer|mets|mettre|adapte|adapter)\b/i;
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
  if (CONTEXTUAL_REFERENCE.test(message)) {
    if (contextualCandidates.length === 1) {
      return { kind: "modify", impact: "moderate", instruction: `${message}\n\nContexte auquel cette demande fait référence : ${contextualCandidates[0]}. Conserve le sens de cette demande précédente et applique uniquement l’amélioration actuelle.` };
    }
    if (contextualCandidates.length > 1) {
      return { kind: "clarify", impact: "safe", answer: `Je peux le faire. Tu parles de **${contextualCandidates[0]}** ou de **${contextualCandidates[1]}** ?` };
    }
    return { kind: "clarify", impact: "safe", answer: "Je peux l’améliorer. Quel élément précis veux-tu reprendre : la page, le bouton ou le parcours concerné ?" };
  }
  if (CHANGE.test(message)) return { kind: "modify", impact: "moderate", instruction: message };
  return { kind: "conversation", impact: "safe" };
}
