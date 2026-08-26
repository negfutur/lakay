import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/DomainLaunchPage.tsx"), "utf8");
const builderSource = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Lakay project domain launch", () => {
  it("keeps purchase at Name.com and does not make unsupported availability or DNS claims", () => {
    expect(source).toContain("Voir chez Name.com");
    expect(source).toContain("La disponibilité et le prix final sont vérifiés uniquement sur Name.com.");
    expect(source).toContain("Nous ne montrons pas de fausses adresses DNS.");
    expect(source).toContain("Lakay ne stocke jamais votre mot de passe registrar");
  });

  it("provides only user-owned domain preparation until a verified web deployment exists", () => {
    expect(source).toContain("J’ai ce domaine");
    expect(source).toContain("Publication web confirmée");
    expect(source).toContain("Vérification, HTTPS et statut Live");
  });

  it("routes web publication actions to the project-scoped domain-launch page", () => {
    expect(builderSource).toContain('navigate(`/projects/${projectId}/domains`)');
  });
});
