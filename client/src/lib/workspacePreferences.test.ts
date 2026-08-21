import { describe, expect, it } from "vitest";
import { applyWorkspacePreferences, DEFAULT_WORKSPACE_PREFERENCES, isQuickSwitchShortcut, parseWorkspacePreferences, postBuildDestination, withDensityPreviewOverride } from "./workspacePreferences";

describe("workspace preferences", () => {
  it("uses safe defaults for missing or malformed saved preferences", () => {
    expect(parseWorkspacePreferences(null)).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(parseWorkspacePreferences("not-json")).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it("preserves saved preview behavior and resolves the correct post-build tab", () => {
    const preferences = parseWorkspacePreferences(JSON.stringify({ autoPreview: false, compactWorkspace: true }));
    expect(preferences.compactWorkspace).toBe(true);
    expect(postBuildDestination(preferences)).toBe("files");
    expect(postBuildDestination(DEFAULT_WORKSPACE_PREFERENCES)).toBe("preview");
  });

  it("recognizes the original command shortcut on macOS and Windows/Linux", () => {
    expect(isQuickSwitchShortcut({ metaKey: true, ctrlKey: false, key: "k" })).toBe(true);
    expect(isQuickSwitchShortcut({ metaKey: false, ctrlKey: true, key: "K" })).toBe(true);
    expect(isQuickSwitchShortcut({ metaKey: false, ctrlKey: false, key: "k" })).toBe(false);
  });

  it("applies compact density to the real workspace root rather than only storing it", () => {
    const calls: Array<[string, string]> = [];
    const root = { dataset: {}, style: { setProperty: (name: string, value: string) => calls.push([name, value]) } };

    applyWorkspacePreferences(root, { reduceMotion: true, compactWorkspace: true, autoPreview: false });
    expect(root.dataset).toMatchObject({ reduceMotion: "true", workspaceDensity: "compact" });
    expect(calls).toContainEqual(["--lakay-card-padding", "1rem"]);

    applyWorkspacePreferences(root, DEFAULT_WORKSPACE_PREFERENCES);
    expect(root.dataset.workspaceDensity).toBe("comfortable");
    expect(calls).toContainEqual(["--lakay-card-padding", ""]);
  });

  it("allows a compact density preview override without changing stored preferences", () => {
    expect(withDensityPreviewOverride(DEFAULT_WORKSPACE_PREFERENCES, "compact")).toMatchObject({ compactWorkspace: true });
    expect(withDensityPreviewOverride({ ...DEFAULT_WORKSPACE_PREFERENCES, compactWorkspace: true }, "comfortable")).toMatchObject({ compactWorkspace: false });
    expect(withDensityPreviewOverride(DEFAULT_WORKSPACE_PREFERENCES, "unexpected")).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
  });
});
