import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { makeStandalonePreviewDocument } from "../lib/staticPreview";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder standalone preview guard", () => {
  it("opens a Lakay-owned shell that returns to the same Builder workspace", () => {
    expect(source).toContain('new URL(`/projects/${projectId}/build`, window.location.origin).toString()');
    expect(source).toContain('makeStandalonePreviewDocument({ previewDocument, returnUrl, projectName: project?.name || "Projet Lakay", initialDevice: device })');
    expect(source).toContain('const blob = new Blob([standalonePreviewDocument], { type: "text/html" })');
    expect(source).toContain('popup.opener = null');
  });

  it("keeps the generated document isolated inside a sandboxed child frame with explicit format controls", () => {
    const standalone = makeStandalonePreviewDocument({ previewDocument: "<main id='app'>Preview</main>", returnUrl: "https://lakay.example/projects/project-1/build", projectName: "PenséeFlash", initialDevice: "mobile" });

    expect(standalone).toContain("Aperçu isolé");
    expect(standalone).toContain("Retour à Lakay");
    expect(standalone).toContain("Ordinateur");
    expect(standalone).toContain("Téléphone");
    expect(standalone).toContain('sandbox="allow-scripts"');
    expect(standalone).toContain('referrerpolicy="no-referrer"');
    expect(standalone).toContain("default-src 'none'");
    expect(standalone).toContain("frame-src 'self' blob: data:");
    expect(standalone).not.toContain('window.opener');
    expect(standalone).toContain('data-device="mobile"');
  });
});
