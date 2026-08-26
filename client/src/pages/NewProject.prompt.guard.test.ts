import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");

describe("Lakay New Project prompt-first surface", () => {
  it("uses the original immersive mobile-first French creation flow", () => {
    expect(source).toContain("Que souhaitez-vous créer en premier");
    expect(source).toContain("Décrivez votre idée, Lakay lui donnera vie…");
    expect(source).toContain("relative isolate min-h-[calc(100svh-3rem)] overflow-hidden");
    expect(source).not.toContain("lakay-density-card");
    expect(source).toContain("bg-sky-500/20");
    expect(source).toContain("[background-size:32px_32px]");
  });

  it("keeps the real creation submit path with target-aware generation, credits, and an initial visual reference", () => {
    expect(source).toContain("<form onSubmit={event => { event.preventDefault(); void create(); }}");
    expect(source).toContain("createProject.mutate({ description: createDescription, target, requestId, initialImage })");
    expect(source).toContain("<DashboardLayout>");
    expect(source).toContain('type BuildTarget = "web" | "mobile"');
    expect(source).toContain('id="lakay-initial-image"');
    expect(source).toContain('accept="image/jpeg,image/png,image/webp"');
    expect(source).toContain("Image de référence ajoutée · elle guidera la V1");
    expect(source).toContain("file.size > 5_000_000");
    expect(source).not.toContain("Les pièces jointes seront disponibles dans une prochaine étape.");
    expect(source).toContain("La saisie vocale n’est pas encore activée.");
    expect(source).toContain("disabled={isBusy || !canGenerate}");
    expect(source).toContain("Générer l’application");
  });

  it("offers clear Web App and Mobile App selectors", () => {
    expect(source).toContain("Web App");
    expect(source).toContain("Mobile App");
    expect(source).toContain('setTarget("web")');
    expect(source).toContain('setTarget("mobile")');
    expect(source).toContain('aria-label="Type d’application"');
  });
});
