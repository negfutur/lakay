import { describe, expect, it } from "vitest";
import { canAutoExecuteIntegration, findLakayIntegration, getLakayIntegrationRegistry } from "./integrationRegistry";

describe("Lakay integration registry", () => {
  it("declares modular capability groups without exposing provider credentials", () => {
    const registry = getLakayIntegrationRegistry();
    expect(registry.map(integration => integration.category)).toEqual(expect.arrayContaining(["intelligence", "images", "audio", "research", "maps", "communication", "payments", "authentication", "data", "storage", "analytics", "execution"]));
    expect(JSON.stringify(registry)).not.toContain("STRIPE_SECRET_KEY");
    expect(JSON.stringify(registry)).not.toContain("GEMINI_API_KEY");
  });

  it("only auto-executes active safe integrations and keeps payment high-impact", () => {
    const ai = findLakayIntegration("ai-routing");
    const stripe = findLakayIntegration("stripe");
    expect(ai && canAutoExecuteIntegration(ai)).toBe(true);
    expect(stripe).toMatchObject({ defaultImpact: "high" });
    expect(stripe && canAutoExecuteIntegration(stripe)).toBe(false);
  });
});
