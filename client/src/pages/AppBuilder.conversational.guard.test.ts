import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder conversational copilot guard", () => {
  it("routes chat through intent-aware conversation before generating files", () => {
    expect(source).toContain("const converse = trpc.builder.converse.useMutation()");
    expect(source).toContain("const sendBuilderMessage = async (message: string, imageKey?: string)");
    expect(source).toContain("if (response.intent === \"build\")");
    expect(source).toContain("buildFromPrompt(response.instruction || prompt, { showUserMessage: false, continuation: Boolean(response.instruction) })");
    expect(source).toContain("onSendMessage={sendBuilderMessage}");
    expect(source).toContain("onUploadImage={async file");
  });

  it("shows a friendly response state and question-oriented guidance", () => {
    expect(source).toContain("Lecture de l’historique et des fichiers…");
    expect(source).toContain("Analyse de la demande et de ses impacts…");
    expect(source).toContain("La réponse n’a pas pu être finalisée");
    expect(source).toContain("error={conversationError ?");
    expect(source).toContain("recoverableBackgroundTask");
    expect(source).toContain("Posez une question ou décrivez un changement…");
    expect(source).toContain("Qu’est-ce qui est déjà prêt ?");
    expect(source).toContain("Discutez du projet ou demandez une modification.");
    expect(source).toContain("C’est fait : j’ai appliqué votre demande");
  });

  it("only starts generation for an explicit build decision", () => {
    expect(source).toContain('if (response.intent === "build")');
    expect(source).toContain("response.instruction || prompt");
    expect(source).not.toContain("continuationAnswer");
  });
});
