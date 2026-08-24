import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const shell = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const creation = readFileSync(resolve(process.cwd(), "client/src/pages/NewProject.tsx"), "utf8");
const landing = readFileSync(resolve(process.cwd(), "client/src/pages/Landing.tsx"), "utf8");

describe("Lakay unified root navigation", () => {
  it("uses one compact top bar and one drawer with the ordered authenticated actions", () => {
    expect(shell).toContain("<Sheet open={drawerOpen}");
    expect(shell).toContain("Nouvelle création");
    expect(shell).toContain("Mes projets");
    expect(shell).toContain("Plans & Crédits");
    expect(shell).toContain("Paramètres");
    expect(shell).toContain("Voir les plans");
    expect(shell).toContain("user.email");
    expect(shell).not.toContain("Rechercher");
    expect(shell).not.toContain("CommandDialog");
  });

  it("removes page-level authenticated header duplication", () => {
    expect(creation).not.toContain("SidebarTrigger");
    expect(landing).toContain("isAuthenticated ? <DashboardLayout>");
  });
});
