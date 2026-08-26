import { describe, expect, it } from "vitest";
import { classifyBuilderChatIntent } from "./builderChat";

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
});
