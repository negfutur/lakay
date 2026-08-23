import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("Lakay premium creation journey", () => {
  it("keeps the first conversation durable and opens the initial handoff only once", () => {
    const projects = source("../../../server/projects.ts");
    const builder = source("./AppBuilder.tsx");

    expect(projects).toContain("Initial creation conversation could not be persisted");
    expect(projects).toContain('role: "user"');
    expect(projects).toContain('role: "assistant"');
    expect(builder).toContain("const [createdHandoff, setCreatedHandoff]");
    expect(builder).toContain("window.history.replaceState");
    expect(builder).toContain('params.delete("handoff")');
  });

  it("keeps users informed through project setup, generation, and preview completion", () => {
    const newProject = source("./NewProject.tsx");
    const chat = source("../components/AIChatBox.tsx");
    const builder = source("./AppBuilder.tsx");

    expect(newProject).toContain("Lakay prépare votre espace de création…");
    expect(chat).toContain("useEffect(() => {");
    expect(chat).toContain("scrollToBottom();");
    expect(chat).toContain("sendSuggestedPrompt");
    expect(builder).toContain("La mise à jour est prête pour");
    expect(builder).toContain("Votre projet et votre aperçu sont conservés");
  });
});
