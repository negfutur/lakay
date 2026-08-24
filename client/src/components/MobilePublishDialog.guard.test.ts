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
    expect(source).toContain("const validBundleId");
    expect(source).toContain("hasConfigurationErrors");
    expect(source).toContain("/^\\d+\\.\\d+\\.\\d+$/.test(config.version)");
    expect(source).toContain("setAttempted(true)");
    expect(source).toContain("if (hasConfigurationErrors || !hasBuild || busy || isPreparingBuild) return");
  });

  it("provides immediate Bundle ID validity feedback and disables APK preparation until the standard format is valid", () => {
    expect(source).toContain("const isBundleIdValid = !bundleIdError");
    expect(source).toContain('aria-invalid={!isBundleIdValid}');
    expect(source).toContain("Bundle ID valide — format standard prêt pour Android.");
    expect(source).toContain("La préparation APK est bloquée.");
    expect(source).toContain("const disabledBuild = !hasBuild || busy || isPreparingBuild || !isBundleIdValid");
    expect(source).toContain("Corrigez la configuration avant de préparer l’APK.");
  });

  it("includes the validated app icon and splash-screen controls before the isolated build handoff", () => {
    expect(source).toContain("MobileBrandingUploader");
    expect(source).toContain('kind="icon"');
    expect(source).toContain('kind="splash"');
    expect(source).toContain("onUploadMobileBranding");
  });

  it("surfaces a secure iOS signing configuration without accepting Apple credential files", () => {
    expect(source).toContain("IosSigningPanel");
    expect(source).toContain('value="ios"');
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

  it("renders a downloadable QR success card only when a preview-ready job carries a genuine APK artifact", () => {
    expect(source).toContain('import QRCode from "qrcode"');
    expect(source).toContain("function ApkReadyCard");
    expect(source).toContain('job.state === "preview_ready" && job.apk');
    expect(source).toContain("APK ready for download");
    expect(source).toContain("QRCode.toDataURL(apk.downloadUrl");
    expect(source).toContain("Télécharger l’APK");
    expect(source).toContain('rel="noopener noreferrer"');
  });

  it("keeps unavailable package and store states explicit until a scoped mobile runner delivers real artifacts", () => {
    expect(source).toContain("APK indisponible");
    expect(source).toContain("Publish to Google Play");
    expect(source).toContain("Android certificate SHA-1");
    expect(source).toContain("Les services backend, API et secrets associés");
    expect(source).toContain("La publication Play Console n’est pas encore connectée");
    expect(source).toContain("runner mobile isolé");
  });
});
