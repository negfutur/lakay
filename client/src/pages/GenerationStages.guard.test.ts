import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const newProject = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");

describe("Lakay generation progress and credit recovery", () => {
  it("shows explicit analysis, code-writing, and preview-finalization stages", () => {
    expect(builder).toContain("Analyse du prompt…");
    expect(builder).toContain("Écriture du code…");
    expect(builder).toContain("Finalisation de la prévisualisation…");
    expect(builder).toContain('loadingMessage={isConversing ? conversationStatus : generationStageLabel}');
    expect(builder).toContain("La réponse prend plus de temps que prévu");
  });

  it("presents exhausted-credit recovery in both creation and builder entry points", () => {
    expect(builder).toContain("Solde de crédits épuisé");
    expect(newProject).toContain("Solde de crédits épuisé");
    expect(builder).toContain('navigate("/plans")');
  });
});
