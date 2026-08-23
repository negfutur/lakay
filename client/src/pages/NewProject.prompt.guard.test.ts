import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./NewProject.tsx", import.meta.url), "utf8");

describe("Lakay New Project prompt-first surface", () => {
  it("uses the compact French prompt flow instead of the former rigid creation card", () => {
    expect(source).toContain("Quelle est votre vision aujourd’hui");
    expect(source).toContain("Ex: App de location de vélos entre particuliers...");
    expect(source).toContain("relative isolate min-h-[calc(100svh-5rem)] overflow-hidden");
    expect(source).not.toContain("lakay-density-card");
    expect(source).toContain("bg-emerald-500/[0.11]");
    expect(source).toContain("[background-size:32px_32px]");
  });

  it("keeps the real creation submit path with a strict flex prompt layout", () => {
    expect(source).toContain("<form onSubmit={event => { event.preventDefault(); create(); }}");
    expect(source).toContain("createProject.mutate({ description, requestId })");
    expect(source).toContain("relative flex min-h-[68px] items-center justify-between");
    expect(source).toContain("flex-1 min-w-0");
    expect(source).toContain("pr-[120px]");
    expect(source).toContain("Ajouter une pièce jointe");
    expect(source).toContain("Les pièces jointes seront disponibles dans une prochaine étape.");
    expect(source).toContain("La saisie vocale n’est pas encore activée.");
    expect(source).toContain("disabled={createProject.isPending || !canGenerate}");
    expect(source).toContain("Générer l’application");
  });

  it("presents each template with an explanation and only prefills the prompt", () => {
    expect(source).toContain("SaaS Dashboard");
    expect(source).toContain("Statistiques, abonnements, analytics");
    expect(source).toContain("Location");
    expect(source).toContain("Gestion de biens, réservations, paiements");
    expect(source).toContain("E-commerce");
    expect(source).toContain("Catalogue, panier, checkout sécurisé");
    expect(source).toContain("setDescription(template.prompt)");
  });
});
