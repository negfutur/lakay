import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./Landing.tsx", import.meta.url), "utf8");

describe("Lakay direct-access landing page", () => {
  it("prioritizes connection and creating a project over marketing detail", () => {
    expect(source).toContain("Se connecter");
    expect(source).toContain("Créer un projet");
    expect(source).toContain('navigate("/projects/new")');
    expect(source).toContain("Créez votre application.");
    expect(source).not.toContain("The thoughtful start for every product");
    expect(source).not.toContain("capabilities");
    expect(source).not.toContain('id="workflow"');
  });
});
