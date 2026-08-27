import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder publication navigation guard", () => {
  it("uses the persisted target for the main Publish action", () => {
    expect(source).toContain("const setMobilePublishOpen = (open: boolean) => {");
    expect(source).toContain('if (project?.target === "mobile")');
    expect(source).toContain("navigate(`/projects/${projectId}/publish`);");
    expect(source).toContain("Créez d’abord une version avant de préparer sa publication web.");
  });

  it("keeps mobile publication and custom-domain setup as separately labelled actions", () => {
    expect(source).toContain("Publication mobile");
    expect(source).toContain("Nom de domaine (site web)");
    expect(source).toContain('navigate(`/projects/${projectId}/domains`)');
  });
});
