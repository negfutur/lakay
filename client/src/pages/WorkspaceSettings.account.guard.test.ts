import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./WorkspaceSettings.tsx", import.meta.url), "utf8");

describe("Lakay account settings hub", () => {
  it("provides the requested premium profile, preferences, and integrations tabs", () => {
    expect(source).toContain('id: "profile", label: "Profil & Compte"');
    expect(source).toContain('id: "preferences", label: "Préférences"');
    expect(source).toContain('id: "integrations", label: "Intégrations & Publication"');
  });

  it("binds real account and credit data while keeping unavailable services truthful", () => {
    expect(source).toContain("useAuth({ redirectOnUnauthenticated: true");
    expect(source).toContain("trpc.billing.balance.useQuery");
    expect(source).toContain("trpc.billing.packages.useQuery");
    expect(source).toContain("Connectez vos outils lorsque vous êtes prêt.");
    expect(source).toContain("disabled");
    expect(source).not.toContain("Safe execution boundary");
  });

  it("presents simple credit plan cards without technical checkout copy", () => {
    expect(source).toContain("500 crédits");
    expect(source).toContain("1 000 crédits");
    expect(source).toContain("Pass Illimité");
    expect(source).not.toContain("Aucun package Stripe approuvé");
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
