import { describe, expect, it } from "vitest";
import { assessProjectAgentRequest } from "./projectAgent";

const project = {
  id: "agent-project",
  userId: 1,
  name: "Réservation simple",
  description: "Une application de réservation pour petits hôtels.",
  status: "ready",
  generatedPlan: {
    name: "Réservation simple",
    tagline: "Réserver sans friction",
    summary: "Une expérience de réservation directe.",
    goals: ["Permettre une réservation rapide"],
    features: ["Disponibilités", "Confirmation"],
    techStack: [],
    components: [],
    milestones: [],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
} as never;

const files = [{ path: "index.html", language: "html", content: "<main>Réserver</main>" }] as never;

describe("Lakay project agent decisions", () => {
  it("acts directly for a clear incremental modification", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Change le bouton principal en bleu." })).toMatchObject({
      kind: "modify",
      impact: "moderate",
      instruction: "Change le bouton principal en bleu.",
    });
  });

  it("asks only for the missing critical payment provider", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Ajoute un système de paiement." })).toMatchObject({
      kind: "clarify",
      impact: "safe",
      answer: expect.stringContaining("Stripe"),
    });
  });

  it("returns a concise contextual plan for a complex request without modifying files", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Transforme cette idée en application complète." })).toMatchObject({
      kind: "plan",
      impact: "safe",
      answer: expect.stringContaining("Disponibilités"),
    });
  });

  it("resolves one clear contextual reference from the saved conversation instead of asking the user to repeat it", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Rends-la plus moderne.", history: [{ role: "user", content: "Ajoute une page de profil pour les voyageurs." }] })).toMatchObject({
      kind: "modify",
      impact: "moderate",
      instruction: expect.stringContaining("page de profil"),
    });
  });

  it("asks one concise question when a contextual reference has two plausible prior targets", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Fais-le comme avant.", history: [
      { role: "user", content: "Ajoute une page de profil." },
      { role: "assistant", content: "La page est prête." },
      { role: "user", content: "Change le bouton de réservation en bleu." },
    ] })).toMatchObject({ kind: "clarify", impact: "safe", answer: expect.stringContaining("bouton de réservation") });
  });

  it("requires a durable explicit confirmation for high-impact publication", () => {
    expect(assessProjectAgentRequest({ project, files, message: "Publie l’application maintenant." })).toMatchObject({
      kind: "confirm",
      impact: "high",
      instruction: "Publie l’application maintenant.",
    });
  });

  it("uses only the current project’s pending action on confirmation or cancellation", () => {
    const pendingAction = { id: "owned-action", instruction: "Publie l’application maintenant.", summary: "Publie l’application maintenant." };
    expect(assessProjectAgentRequest({ project, files, message: "Confirmer", pendingAction })).toMatchObject({ kind: "confirmed", actionId: "owned-action" });
    expect(assessProjectAgentRequest({ project, files, message: "Annuler", pendingAction })).toMatchObject({ kind: "cancelled", actionId: "owned-action" });
  });
});
