import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Lakay in-memory preview runtime", () => {
  const builder = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

  it("opens the Lakay-owned standalone preview shell through a revocable Blob URL", () => {
    expect(builder).toContain("makeStandalonePreviewDocument({ previewDocument, returnUrl, projectName: project?.name || \"Projet Lakay\", initialDevice: device })");
    expect(builder).toContain('new Blob([standalonePreviewDocument], { type: "text/html" })');
    expect(builder).toContain("URL.createObjectURL(blob)");
    expect(builder).toContain('window.open("about:blank", "_blank")');
    expect(builder).toContain("popup.opener = null");
    expect(builder).toContain("popup.location.replace(url)");
    expect(builder).toContain("window.location.assign(url)");
    expect(builder).toContain("URL.revokeObjectURL(url)");
  });

  it("renders a transition-ready 375 px mobile device frame around the secure srcdoc iframe", () => {
    expect(builder).toContain('w-[375px] max-w-[calc(100vw-1.5rem)] rounded-2xl');
    expect(builder).toContain("transition-[width,max-width,transform,box-shadow] duration-300");
    expect(builder).toContain('sandbox="allow-scripts"');
    expect(builder).toContain("srcDoc={previewDocument}");
  });
});
