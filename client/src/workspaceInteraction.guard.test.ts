import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Lakay workspace interactions", () => {
  it("registers the workspace settings route and presents it in primary navigation", () => {
    const app = source("client/src/App.tsx");
    const shell = source("client/src/components/DashboardLayout.tsx");

    expect(app).toContain('Route path="/settings" component={WorkspaceSettings}');
    expect(shell).toContain('{ icon: Settings2, label: "Settings", path: "/settings"');
    expect(shell).toContain('navigate("/settings")');
  });

  it("keeps quick navigation available through keyboard and touch entry points", () => {
    const shell = source("client/src/components/DashboardLayout.tsx");
    const preferences = source("client/src/lib/workspacePreferences.ts");

    expect(shell).toContain("isQuickSwitchShortcut(event)");
    expect(preferences).toContain('(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k"');
    expect(shell).toContain("<CommandDialog open={quickOpen}");
    expect(shell).toContain('aria-label="Rechercher"');
    expect(shell).toContain("Lakay quick switch");
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
