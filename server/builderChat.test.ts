import { describe, expect, it } from "vitest";
import { classifyBuilderChatIntent, createLocalBuilderFallbackReply } from "./builderChat";

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

  it("keeps a question helpful without claiming a change when the provider is unavailable", () => {
    const reply = createLocalBuilderFallbackReply({
      project: { id: "project", userId: 1, name: "PenséeFlash", description: "Capture d’idées", status: "ready", generatedPlan: null, createdAt: new Date(), updatedAt: new Date() } as never,
      files: [{ path: "index.html", language: "html", content: "<main>Idées</main>" }] as never,
      message: "Il reste quoi à faire ?",
    });
    expect(reply).toContain("n’a pas été modifiée");
    expect(reply).toContain("prochaine étape");
  });
});
