import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/MobilePublishDialog.tsx"), "utf8");

describe("Lakay mobile publishing panel", () => {
  it("offers professional Android and iOS publication surfaces with source-version context", () => {
    expect(source).toContain("Publish Mobile App");
    expect(source).toContain('value="android"');
    expect(source).toContain('value="ios"');
    expect(source).toContain("Personal Use &amp; Limited Distribution");
    expect(source).toContain("You have unpackaged changes");
    expect(source).toContain("Configuration avant compilation");
    expect(source).toContain('aria-label="Nom de l’application"');
    expect(source).toContain('aria-label="Bundle ID"');
    expect(source).toContain('aria-label="Version"');
    expect(source).toContain("Version history");
    expect(source).toContain("Build APK");
  });

  it("validates the required build metadata before a runner-bound APK request is prepared", () => {
    expect(source).toContain("function getConfigurationErrors");
    expect(source).toContain("com.votreentreprise.votreapp");
    expect(source).toContain("format 1.0.0");
    expect(source).toContain("setAttemptedBuild(true)");
    expect(source).toContain("if (hasConfigurationErrors || !hasBuild || busy || isPreparingBuild) return");
  });

  it("provides immediate Bundle ID validity feedback and disables APK preparation until the standard format is valid", () => {
    expect(source).toContain("const isBundleIdValid = !bundleIdError");
    expect(source).toContain('aria-invalid={!isBundleIdValid}');
    expect(source).toContain("Bundle ID valide — format standard prêt pour Android.");
    expect(source).toContain("La préparation APK est bloquée.");
    expect(source).toContain("const disabledBuild = !hasBuild || busy || isPreparingBuild || !isBundleIdValid");
    expect(source).toContain("Corrigez le Bundle ID pour autoriser la préparation de l’APK.");
  });

  it("shows animated, detailed APK preparation feedback without claiming that a runner has completed a build", () => {
    expect(source).toContain("AndroidBuildProgressPanel");
    expect(source).toContain("Vérification de la configuration");
    expect(source).toContain("Préparation du contrat isolé");
    expect(source).toContain("En attente d’un runner Android");
    expect(source).toContain("L’APK restera indisponible jusqu’à la fin réelle du build");
    expect(source).toContain("transition-[width] duration-500");
    expect(source).toContain("aria-live=\"polite\"");
  });

  it("keeps unavailable package and store states explicit until a scoped mobile runner delivers real artifacts", () => {
    expect(source).toContain("APK indisponible");
    expect(source).toContain("Publish to Google Play");
    expect(source).toContain("Android certificate SHA-1");
    expect(source).toContain("Les services backend, API et secrets associés");
    expect(source).toContain("La publication Play Console n’est pas encore connectée");
    expect(source).toContain("iOS runner not configured");
    expect(source).toContain("runner mobile isolé");
  });
});
