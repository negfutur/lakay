import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("../components/AIChatBox.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const projects = readFileSync(new URL("../../../server/projects.ts", import.meta.url), "utf8");

describe("Lakay truthful build failure recovery", () => {
  it("detects non-JSON API responses before tRPC attempts to parse HTML", () => {
    expect(main).toContain('contentType.includes("application/json")');
    expect(main).toContain("Lakay API returned an unexpected response");
  });

  it("never presents a failed build as complete and exposes a retry that preserves the preview", () => {
    expect(builder).toContain("getBuildFailureMessage");
    expect(builder).toContain("setBuildFailure(failureMessage)");
    expect(builder).toContain("retryBackgroundGenerate");
    expect(builder).toContain("recoverableBackgroundTask");
    expect(builder).toContain("activeBuildRef");
    expect(builder).toContain("const isRetry");
    expect(builder).toContain("onMutate: ({ taskId })");
    expect(builder).toContain("Relance de tâche échouée");
    expect(builder).toContain("hidePersistedTerminalFailureMessage: true");
    expect(builder).toContain("originalIdea");
    expect(builder).toContain("L’aperçu apparaîtra ici.");
    expect(builder).toContain("Lakay ne marque l’application comme terminée");
    expect(builder).toContain('setMobilePane("chat")');
    expect(chat).toContain("je n[’']ai pas pu terminer l[’']analyse de cette demande");
    expect(chat).toContain("la version actuelle est conservée");
  });

  it("describes a new project as immediately entering its V1 generation", () => {
    expect(projects).toContain("Très bien — je prépare la V1");
    expect(projects).toContain("[[lakay:open-preview]]");
    expect(projects).toContain("Ensuite, nous pourrons affiner");
  });
});
