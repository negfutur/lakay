import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/MobilePublishPage.tsx"), "utf8");

describe("Lakay dedicated mobile publishing page", () => {
  it("uses a spacious route with a project return action and premium Android/iOS sections", () => {
    expect(source).toContain("Retour au projet");
    expect(source).toContain("max-w-4xl");
    expect(source).toContain("Générez votre application Android");
    expect(source).toContain("Informations générales");
    expect(source).toContain("Visuels");
    expect(source).toContain("App Store &amp; TestFlight");
  });

  it("shows preparation feedback instead of an infrastructure error", () => {
    expect(source).toContain("Préparation du serveur de compilation...");
    expect(source).toContain("La préparation de la génération n’a pas pu démarrer.");
    expect(source).not.toContain("runner Android isolé");
  });

  it("uses the protected mobile authorization access state and labels the 7 USD flow as a test", () => {
    expect(source).toContain("trpc.builder.getMobileBuildAccess.useQuery");
    expect(source).toContain("trpc.builder.authorizeSimulatedMobileBuild.useMutation");
    expect(source).toContain("Accès test administrateur — génération incluse");
    expect(source).toContain("$7 USD — paiement test");
    expect(source).toContain("Débloquer la génération (test)");
    expect(source).toContain("aucun prélèvement réel");
    expect(source).toContain("!mobileAccess?.authorized");
  });
});
