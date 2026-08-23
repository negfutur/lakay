import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const newProject = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");

describe("Lakay project-to-builder handoff", () => {
  it("opens a newly created project directly in the visible guided chat", () => {
    expect(newProject).toContain("?handoff=created");
    expect(builder).toContain('get("handoff") === "created"');
    expect(builder).toContain("if (createdHandoff) {");
    expect(builder).toContain('setMobilePane("chat");');
    expect(builder).toContain('params.delete("handoff")');
    expect(builder).toContain("Votre projet **${project.name}** est prêt.");
  });

  it("keeps the conversation visible during generation before moving to preview", () => {
    expect(builder).toContain('setMobilePane("chat");');
    expect(builder).toContain('setMobilePane("preview")');
    expect(builder).toContain("Création en cours");
  });
});
