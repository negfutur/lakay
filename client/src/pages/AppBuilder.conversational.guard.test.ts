import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder conversational copilot guard", () => {
  it("routes chat through intent-aware conversation before generating files", () => {
    expect(source).toContain("const converse = trpc.builder.converse.useMutation()");
    expect(source).toContain("const sendBuilderMessage = async (message: string)");
    expect(source).toContain("if (response.intent === \"build\")");
    expect(source).toContain("buildFromPrompt(prompt, { showUserMessage: false })");
    expect(source).toContain("onSendMessage={sendBuilderMessage}");
  });

  it("shows a friendly response state and question-oriented guidance", () => {
    expect(source).toContain("Lakay prépare une réponse utile…");
    expect(source).toContain("Posez une question ou décrivez un changement…");
    expect(source).toContain("Qu’est-ce qui est déjà prêt ?");
    expect(source).toContain("Discutez du projet ou demandez une modification.");
    expect(source).toContain("C’est fait : j’ai appliqué votre demande");
  });
});
