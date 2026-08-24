import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./WorkspaceSettings.tsx", import.meta.url), "utf8");

describe("Lakay account settings hub", () => {
  it("provides the requested premium profile, preferences, and integrations tabs", () => {
    expect(source).toContain('id: "profile", label: "Profil & Compte"');
    expect(source).toContain('id: "preferences", label: "Préférences"');
    expect(source).toContain('id: "integrations", label: "Intégrations & Publication"');
  });

  it("binds real account data while keeping unavailable integrations truthful", () => {
    expect(source).toContain("useAuth({ redirectOnUnauthenticated: true");
    expect(source).toContain("Connectez vos outils lorsque vous êtes prêt.");
    expect(source).toContain("disabled");
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
