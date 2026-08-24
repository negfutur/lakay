import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landing = readFileSync(resolve(process.cwd(), "client/src/pages/Landing.tsx"), "utf8");
const creation = readFileSync(resolve(process.cwd(), "client/src/pages/NewProject.tsx"), "utf8");

describe("Lakay minimal creation headers", () => {
  it("uses a hamburger action and a dynamic credit badge on the public landing page", () => {
    expect(landing).toContain('aria-label="Ouvrir la navigation"');
    expect(landing).toContain("<Menu");
    expect(landing).toContain("creditBalance?.balance ?? 0");
    expect(landing).not.toContain("LakayMark");
    expect(landing).not.toContain("Mes projets");
  });

  it("replaces the legacy creation-page back label with compact navigation and credits", () => {
    expect(creation).toContain('aria-label="Ouvrir la navigation"');
    expect(creation).toContain("<SidebarTrigger");
    expect(creation).toContain("minimalChrome");
    expect(creation).toContain("creditBalance?.balance ?? 0");
    expect(creation).not.toContain("Retour aux projets");
    expect(creation).toContain("Décrivez votre idée, Lakay lui donnera vie…");
  });
});
