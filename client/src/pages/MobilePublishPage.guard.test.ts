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
    expect(source).toContain("Préparation du serveur de compilation en cours. Réessayez dans quelques instants.");
    expect(source).not.toContain("runner Android isolé");
  });
});
