import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const newProject = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");
const projects = readFileSync(new URL("../../../server/projects.ts", import.meta.url), "utf8");

describe("Lakay project-to-builder handoff", () => {
  it("opens a newly created project in active chat and launches V1 immediately", () => {
    expect(newProject).toContain("?onboarding=v1");
    expect(builder).toContain('get("onboarding") === "v1"');
    expect(builder).toContain("if (!project || builderLoading || !initialV1Requested");
    expect(builder).toContain('setMobilePane("chat");');
    expect(builder).toContain('params.delete("onboarding")');
    expect(builder).toContain("Construis immédiatement la V1 fonctionnelle");
    expect(projects).toContain("Je vous montrerai l’aperçu seulement après validation de la première version.");
    expect(projects).not.toContain("[[lakay:open-preview]]");
    expect(builder).toContain("automaticV1BuildRef.current = Boolean(options?.automaticV1)");
    expect(builder).toContain("buildFromPrompt(instruction, { automaticV1: true, showUserMessage: false })");
    expect(builder).toContain("if (!automaticV1BuildRef.current) appendAssistantMessageOnce(failureMessage)");
    expect(builder).toContain("onOpenPreview={() => { setWorkspaceTab(\"preview\"); setMobilePane(\"preview\"); }}");
  });

  it("keeps the conversation visible during generation before moving to preview", () => {
    expect(builder).toContain('setMobilePane("chat");');
    expect(builder).toContain('setMobilePane("preview")');
    expect(builder).toContain("Analyse des fichiers…");
  });
});
