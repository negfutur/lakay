import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder publication navigation guard", () => {
  it("opens the project-scoped publication center from the main Publish action", () => {
    expect(source).toContain("const setMobilePublishOpen = (open: boolean) => {");
    expect(source).toContain("navigate(`/projects/${projectId}/publish`);");
  });

  it("keeps web, mobile, and desktop publication as separately labelled actions", () => {
    expect(source).toContain("Publier une Web App");
    expect(source).toContain("Publier une Mobile App");
    expect(source).toContain("Publier sur ordinateur");
    expect(source).toContain('navigate(`/projects/${projectId}/publish/web`)');
    expect(source).toContain('navigate(`/projects/${projectId}/publish/mobile`)');
    expect(source).toContain('navigate(`/projects/${projectId}/publish/desktop`)');
  });
});
