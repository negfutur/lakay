import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Lakay workspace interactions", () => {
  it("registers the workspace settings route and presents it in primary navigation", () => {
    const app = source("client/src/App.tsx");
    const shell = source("client/src/components/DashboardLayout.tsx");

    expect(app).toContain('Route path="/settings" component={WorkspaceSettings}');
    expect(shell).toContain('{ icon: Settings2, label: "Paramètres", path: "/settings"');
    expect(shell).toContain('go("/settings?tab=billing")');
  });

  it("uses the single drawer instead of a duplicate global quick-switch and search surface", () => {
    const shell = source("client/src/components/DashboardLayout.tsx");

    expect(shell).toContain("<Sheet open={drawerOpen}");
    expect(shell).toContain('aria-label="Ouvrir la navigation"');
    expect(shell).not.toContain("CommandDialog");
    expect(shell).not.toContain('aria-label="Rechercher"');
  });

  it("persists workspace preferences and reflects them on the document shell", () => {
    const settings = source("client/src/pages/WorkspaceSettings.tsx");
    const preferences = source("client/src/lib/workspacePreferences.ts");

    expect(preferences).toContain('WORKSPACE_PREFERENCES_KEY = "lakay.workspace-preferences"');
    expect(settings).toContain("localStorage.setItem(WORKSPACE_PREFERENCES_KEY, JSON.stringify(preferences))");
    expect(settings).toContain("applyWorkspacePreferences(document.documentElement, preferences)");
    expect(preferences).toContain("root.dataset.reduceMotion");
    expect(preferences).toContain("root.dataset.workspaceDensity");
  });
});
