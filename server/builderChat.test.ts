import { describe, expect, it } from "vitest";
import { classifyBuilderChatIntent, createContinuationBuilderAction, createImmediateBuilderAcknowledgement, createImmediateProjectProgressReply, createImmediateVersionClarificationReply, createLocalBuilderFallbackReply, isCompleteConversationalReply } from "./builderChat";

describe("Builder conversational intent", () => {
  it("keeps project questions in the conversational path", () => {
    expect(classifyBuilderChatIntent("Il reste quoi à faire dans l’application ?")).toBe("conversation");
    expect(classifyBuilderChatIntent("Dis-moi ce que tu as fait")).toBe("conversation");
    expect(classifyBuilderChatIntent("Pourquoi l’aperçu est vide ?")).toBe("conversation");
  });

  it("routes explicit modification requests to the build path", () => {
    expect(classifyBuilderChatIntent("Ajoute une recherche dans mes idées")).toBe("build");
    expect(classifyBuilderChatIntent("Modifie la couleur principale en bleu")).toBe("build");
  });

  it("treats continuation phrases as action requests and selects the highest-impact planned improvement", () => {
    const action = createContinuationBuilderAction({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: { summary: "Capturer et retrouver les idées importantes.", features: ["Recherche rapide", "Tags"], goals: ["Réduire les oublis"], tagline: "", techStack: [], components: [], milestones: [] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Au boulot",
    });
    expect(classifyBuilderChatIntent("Continuer")).toBe("build");
    expect(action?.acknowledgement).toContain("Je passe à l’action");
    expect(action?.instruction).toContain("Recherche rapide");
  });

  it("keeps a question helpful without claiming a change when the provider is unavailable", () => {
    const reply = createLocalBuilderFallbackReply({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: null, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Il reste quoi à faire ?",
    });
    expect(reply).toContain("n’a pas été modifiée");
    expect(reply).toContain("Je vous propose ensuite");
  });

  it("answers saved project-status questions immediately with a useful local next-step plan", () => {
    const reply = createImmediateProjectProgressReply({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: { summary: "Capturer et retrouver les idées importantes.", features: ["Recherche rapide", "Tags"], goals: ["Réduire les oublis"], tagline: "", techStack: [], components: [], milestones: [] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Il me reste quoi à faire et tu proposerais quoi ?",
    });
    expect(reply).toContain("Déjà prêt");
    expect(reply).toContain("Je vous propose ensuite");
    expect(reply).toContain("Recherche rapide");
    expect(reply).toContain("Votre application n’a pas été modifiée");
  });

  it("answers V1 and V2 clarification questions directly instead of reciting a generic project diagnostic", () => {
    const reply = createImmediateVersionClarificationReply({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: { summary: "Capturer et retrouver les idées importantes.", features: ["Recherche rapide", "Tags"], goals: ["Réduire les oublis"], tagline: "", techStack: [], components: [], milestones: [] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "C'est quoi V1, V2 ?",
    });
    expect(reply).toContain("**V1** = la première version utilisable");
    expect(reply).toContain("**V2** = l’amélioration suivante");
    expect(reply).toContain("Recherche rapide");
    expect(reply).not.toContain("Voici le point le plus utile");
  });

  it("treats a short confirmation as a professional contextual copilot turn without provider delay", () => {
    const reply = createImmediateBuilderAcknowledgement({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: { summary: "Capturer et retrouver les idées importantes.", features: ["Recherche rapide", "Tags"], goals: ["Réduire les oublis"], tagline: "", techStack: [], components: [], milestones: [] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Merci",
    });
    expect(reply).toContain("Je garde la direction actuelle");
    expect(reply).toContain("Recherche rapide");
    expect(reply).toContain("Je n’ai appliqué aucune modification");
  });

  it("keeps a meaningful product diagnosis available when a deeper conversational response is unavailable", () => {
    const reply = createLocalBuilderFallbackReply({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: { summary: "Capturer et retrouver les idées importantes.", features: ["Recherche rapide", "Tags"], goals: ["Réduire les oublis"], tagline: "", techStack: [], components: [], milestones: [] }, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Tu en penses quoi ?",
    });
    expect(reply).toContain("décision la plus utile");
    expect(reply).toContain("Recommandation prioritaire");
    expect(reply).toContain("Recherche rapide");
    expect(reply).not.toContain("dépassé le délai normal");
  });

  it("turns a confirmation into direct execution instead of another acknowledgement", () => {
    expect(classifyBuilderChatIntent("Parfait")).toBe("build");
    expect(createImmediateBuilderAcknowledgement({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: null, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [] as never,
      message: "Parfait",
    })).toBeNull();
  });

  it("rejects incomplete conversational fragments before they reach the visible history", () => {
    expect(isCompleteConversationalReply("Parce que la promesse centrale de PenséeFlash, c", "stop")).toBe(false);
    expect(isCompleteConversationalReply("Parce que le parcours de capture doit rester immédiat.", "stop")).toBe(true);
    expect(isCompleteConversationalReply("Une réponse coupée", "max_tokens")).toBe(false);
  });
});
