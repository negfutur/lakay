import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(new URL("./Dashboard.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../components/DashboardLayout.tsx", import.meta.url), "utf8");

describe("Lakay premium mobile dashboard surfaces", () => {
  it("keeps the dashboard focused on continuing work and real project actions", () => {
    expect(dashboard).toContain("Continuez à créer.");
    expect(dashboard).toContain("Continuer à créer");
    expect(dashboard).toContain("Créé le");
    expect(dashboard).toContain('navigate(`/projects/${project.id}`)');
    expect(dashboard).not.toContain("Ideas in your workspace");
  });

  it("uses only real Lakay destinations and a server-backed credit balance in the navigation", () => {
    expect(layout).toContain("Nouvelle création");
    expect(layout).toContain("Mes projets");
    expect(layout).toContain("trpc.billing.balance.useQuery");
    expect(layout).toContain("Recharger");
    expect(layout).not.toContain("Published Apps");
    expect(layout).not.toContain("Showcase");
  });
});
