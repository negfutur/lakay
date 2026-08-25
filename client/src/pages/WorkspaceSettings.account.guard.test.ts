import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./WorkspaceSettings.tsx", import.meta.url), "utf8");

describe("Lakay account settings hub", () => {
  it("provides profile and preferences to everyone while reserving publication integrations for the administrator", () => {
    expect(source).toContain('id: "profile", label: "Profil & Compte"');
    expect(source).toContain('id: "preferences", label: "Préférences"');
    expect(source).toContain('id: "integrations", label: "Intégrations & Publication"');
    expect(source).toContain('const ADMINISTRATOR_EMAIL = "dormesgaetan16@gmail.com"');
    expect(source).toContain('tabs.filter(item => item.id !== "integrations")');
    expect(source).toContain('isAdministrator && tab === "integrations"');
  });

  it("binds real account data while keeping unavailable integrations truthful", () => {
    expect(source).toContain("useAuth({ redirectOnUnauthenticated: true");
    expect(source).toContain("Le dépôt Lakay est relié au flux de publication Android.");
    expect(source).toContain("Gérer GitHub");
    expect(source).toContain("settings/secrets/actions");
    expect(source).not.toContain("Safe execution boundary");
  });

  it("keeps plan, credit, and payment content out of Settings", () => {
    expect(source).not.toContain("500 crédits");
    expect(source).not.toContain("Pass Illimité");
    expect(source).not.toContain("Plans & Crédits");
  });

  it("retains a French-default language option and real theme controls", () => {
    expect(source).toContain('value="fr">Français');
    expect(source).toContain('value="en">English');
    expect(source).toContain("useTheme()");
    expect(source).toContain("setTheme");
  });

  it("supports direct activation across settings sections", () => {
    expect(source).toContain("setTab(item.id)");
    expect(source).toContain("overflow-x-auto");
  });
});
