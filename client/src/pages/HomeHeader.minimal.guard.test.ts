import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const landing = readFileSync(resolve(process.cwd(), "client/src/pages/Landing.tsx"), "utf8");
const creation = readFileSync(resolve(process.cwd(), "client/src/pages/NewProject.tsx"), "utf8");

describe("Lakay minimal creation headers", () => {
  it("uses a hamburger action and a dynamic credit badge on the public landing page", () => {
    expect(landing).toContain('aria-label="Ouvrir la navigation"');
    expect(landing).toContain("<Menu");
    expect(landing).toContain("return isAuthenticated ? <DashboardLayout>");
    expect(landing).not.toContain('className="h-9 px-3 text-xs text-zinc-300');
  });

  it("delegates connected navigation to the shared RootLayout rather than owning a second drawer", () => {
    expect(landing).toContain("DashboardLayout");
    expect(landing).not.toContain("setMenuOpen");
    expect(landing).not.toContain("<Sheet");
  });

  it("removes the legacy creation-page header so shared RootLayout navigation owns the controls", () => {
    expect(creation).toContain("<DashboardLayout>");
    expect(creation).not.toContain('aria-label="Ouvrir la navigation"');
    expect(creation).not.toContain("SidebarTrigger");
    expect(creation).not.toContain("creditBalance?.balance ?? 0");
    expect(creation).not.toContain("Retour aux projets");
    expect(creation).toContain("Décrivez votre idée, Lakay lui donnera vie…");
  });
});
