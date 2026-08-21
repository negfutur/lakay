export type WorkspacePreferences = {
  reduceMotion: boolean;
  compactWorkspace: boolean;
  autoPreview: boolean;
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  reduceMotion: false,
  compactWorkspace: false,
  autoPreview: true,
};

export const WORKSPACE_PREFERENCES_KEY = "lakay.workspace-preferences";

export function parseWorkspacePreferences(raw: string | null | undefined): WorkspacePreferences {
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<WorkspacePreferences> : {};
    return { ...DEFAULT_WORKSPACE_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_WORKSPACE_PREFERENCES;
  }
}

export function postBuildDestination(preferences: WorkspacePreferences): "preview" | "files" {
  return preferences.autoPreview ? "preview" : "files";
}

export function isQuickSwitchShortcut(event: Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "key">): boolean {
  return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
}

export type WorkspacePreferenceRoot = {
  dataset: Record<string, string | undefined>;
  style: { setProperty: (name: string, value: string) => void };
};

export function applyWorkspacePreferences(root: WorkspacePreferenceRoot, preferences: WorkspacePreferences): void {
  root.dataset.reduceMotion = String(preferences.reduceMotion);
  root.dataset.workspaceDensity = preferences.compactWorkspace ? "compact" : "comfortable";
  root.style.setProperty("--lakay-card-padding", preferences.compactWorkspace ? "1rem" : "");
}

export function withDensityPreviewOverride(preferences: WorkspacePreferences, density: string | null): WorkspacePreferences {
  if (density !== "compact" && density !== "comfortable") return preferences;
  return { ...preferences, compactWorkspace: density === "compact" };
}
