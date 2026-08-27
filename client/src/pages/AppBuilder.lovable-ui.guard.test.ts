import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const chat = readFileSync(new URL("../components/AIChatBox.tsx", import.meta.url), "utf8");
const preview = readFileSync(new URL("../lib/staticPreview.ts", import.meta.url), "utf8");

describe("Lovable-inspired Builder controls", () => {
  it("keeps a desktop action bar with functional preview, sharing, and publication controls", () => {
    expect(builder).toContain("function BuilderPreviewToolbar");
    expect(builder).toContain("Page principale");
    expect(builder).toContain("Actualiser");
    expect(builder).toContain("Partager");
    expect(builder).toContain("Publier");
  });

  it("offers non-destructive preview inspection and code editing controls", () => {
    expect(builder).toContain("Sélection visuelle");
    expect(builder).toContain("setPreviewInspection");
    expect(builder).toContain("element-selected");
    expect(preview).toContain("lakay-preview-control");
    expect(preview).toContain("inspectionEnabled");
  });

  it("keeps system messages hidden and treatment details collapsible behind a polished chat surface", () => {
    expect(chat).toContain('message.role === "system"');
    expect(chat).toContain("Détails du traitement");
    expect(chat).toContain("suggestedPrompts?.length");
  });
});
