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
    expect(landing).not.toContain('className="h-9 px-3 text-xs text-zinc-300');
  });

  it("opens a clear authenticated menu from the landing hamburger instead of routing directly to projects", () => {
    expect(landing).toContain("setMenuOpen(true)");
    expect(landing).toContain("<Sheet open={menuOpen}");
    expect(landing).toContain("Menu Lakay");
    expect(landing).toContain("Nouvelle création");
    expect(landing).toContain("Mes projets");
    expect(landing).toContain("Crédits & facturation");
    expect(landing).toContain("Paramètres");
    expect(landing).not.toContain('isAuthenticated ? navigate("/dashboard")');
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
