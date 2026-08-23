import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");

describe("Lakay New Project prompt-first surface", () => {
  it("uses the compact French prompt flow instead of the former rigid creation card", () => {
    expect(source).toContain("Quelle est votre vision aujourd’hui");
    expect(source).toContain("Décrivez l’application que vous voulez créer…");
    expect(source).toContain("relative isolate min-h-[calc(100svh-5rem)] overflow-hidden");
    expect(source).not.toContain("lakay-density-card");
    expect(source).toContain("bg-violet-500/[0.12]");
  });

  it("keeps the real creation submit path and clear secondary-control states", () => {
    expect(source).toContain("<form onSubmit={event => { event.preventDefault(); create(); }}");
    expect(source).toContain("createProject.mutate({ description, requestId })");
    expect(source).toContain("Ajouter une pièce jointe");
    expect(source).toContain("Les pièces jointes seront disponibles dans une prochaine étape.");
    expect(source).toContain("La saisie vocale n’est pas encore activée.");
    expect(source).toContain("SaaS Dashboard");
    expect(source).toContain("Application de location");
    expect(source).toContain("E-commerce");
  });
});
