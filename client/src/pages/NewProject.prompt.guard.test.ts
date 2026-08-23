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

  it("keeps the real creation submit path with target-aware generation and real credits", () => {
    expect(source).toContain("<form onSubmit={event => { event.preventDefault(); create(); }}");
    expect(source).toContain("createProject.mutate({ description: createDescription, requestId })");
    expect(source).toContain("trpc.billing.balance.useQuery");
    expect(source).toContain("creditBalance?.balance ?? 0");
    expect(source).toContain('target === "mobile" ? "Application mobile" : "Application web"');
    expect(source).toContain("Ajouter une pièce jointe");
    expect(source).toContain("Les pièces jointes seront disponibles dans une prochaine étape.");
    expect(source).toContain("La saisie vocale n’est pas encore activée.");
    expect(source).toContain("disabled={createProject.isPending || !canGenerate}");
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
