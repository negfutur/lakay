import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay intelligent Builder quick action", () => {
  it("prioritizes work already in progress and then safe recovery before new generation", () => {
    expect(builder).toContain('state: "follow", label: "Suivre Lakay"');
    expect(builder).toContain('state: "retry", label: "Reprendre avec Lakay"');
    expect(builder).toContain('state: "repair", label: "Corriger l’aperçu"');
    expect(builder).toContain('state: "create", label: "Créer la V1 avec Lakay"');
    expect(builder).toContain('state: "improve", label: "Améliorer avec Lakay"');
  });

  it("keeps the accelerator within safe Builder actions and does not publish or delete", () => {
    expect(builder).toContain("const runSmartQuickAction");
    expect(builder).toContain("retryBackgroundGenerate.mutate");
    expect(builder).toContain("autoFix.mutate");
    expect(builder).toContain("Préserve ce qui fonctionne");
    expect(builder).toContain("aria-label={smartQuickAction.label}");
  });
});
