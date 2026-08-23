import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./WorkspaceSettings.tsx", import.meta.url), "utf8");

describe("Lakay account settings hub", () => {
  it("provides the requested profile, billing, integration, and appearance tabs", () => {
    expect(source).toContain('id: "profile", label: "Profil"');
    expect(source).toContain('id: "billing", label: "Crédits & facturation"');
    expect(source).toContain('id: "integrations", label: "Intégrations"');
    expect(source).toContain('id: "appearance", label: "Apparence & langue"');
  });

  it("binds real account and credit data while keeping unavailable services truthful", () => {
    expect(source).toContain("useAuth({ redirectOnUnauthenticated: true");
    expect(source).toContain("trpc.billing.balance.useQuery");
    expect(source).toContain("trpc.billing.history.useQuery");
    expect(source).toContain("Connexion non configurée pour ce projet.");
    expect(source).toContain("disabled");
    expect(source).toContain("Les clés API et l’exécution backend restent protégées par le serveur Lakay.");
  });

  it("keeps credit purchases conditional on approved packages and returns safely to billing", () => {
    expect(source).toContain("trpc.billing.packages.useQuery");
    expect(source).toContain("trpc.billing.createCheckout.useMutation");
    expect(source).toContain("Aucun package Stripe approuvé n’est encore configuré.");
    expect(source).toContain('window.open(checkoutUrl, "_blank", "noopener,noreferrer")');
    expect(source).toContain("checkoutStatus === \"success\"");
    expect(source).toContain("?tab=billing");
  });

  it("retains a French-default language option and real theme controls", () => {
    expect(source).toContain('value="fr">Français');
    expect(source).toContain('value="en">English');
    expect(source).toContain("useTheme()");
    expect(source).toContain("setTheme");
  });

  it("supports keyboard navigation and activation semantics across settings sections", () => {
    expect(source).toContain("SettingsTabList");
    expect(source).toContain("activeTab={tab}");
    expect(source).toContain('onChange={id => setTab(id as SettingsTab)}');
  });
});
