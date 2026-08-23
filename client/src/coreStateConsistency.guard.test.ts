import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

describe("Lakay core workflow state consistency", () => {
  it("covers loading, empty, success, and error feedback for project management", () => {
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const newProject = source("client/src/pages/NewProject.tsx");

    expect(dashboard).toContain("ProjectSkeleton");
    expect(dashboard).toContain("EmptyProjects");
    expect(dashboard).toContain('toast.success("Project name saved.")');
    expect(dashboard).toContain("toast.error(error.message)");
    expect(newProject).toContain("createProject.isPending");
    expect(newProject).toContain("toast.message(");
    expect(newProject).toContain("toast.error(");
  });

  it("covers builder loading, successful preview refresh, provider failure, and repair states", () => {
    const builder = source("client/src/pages/AppBuilder.tsx");

    expect(builder).toContain("Lakay construit votre application");
    expect(builder).toContain("Aperçu final en préparation");
    expect(builder).toContain('toast.success("Build complete — preview updated.")');
    expect(builder).toContain("External LLM usage is exhausted");
    expect(builder).toContain("Auto-fix");
    expect(builder).toContain("Runtime preview issue:");
  });

  it("covers project-detail editing and settings feedback surfaces", () => {
    const detail = source("client/src/pages/ProjectDetail.tsx");
    const settings = source("client/src/pages/WorkspaceSettings.tsx");

    expect(detail).toContain("isLoading");
    expect(detail).toContain("This project isn’t available.");
    expect(detail).toContain("Save changes");
    expect(detail).toContain("Delete this project and its conversation?");
    expect(settings).toContain('toast.success("Préférences réinitialisées.")');
    expect(settings).toContain("<Switch checked={checked}");
    expect(settings).toContain("Safe execution boundary");
  });

  it("applies compact density through real workspace surface selectors", () => {
    const css = source("client/src/index.css");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const newProject = source("client/src/pages/NewProject.tsx");
    const builder = source("client/src/pages/AppBuilder.tsx");

    expect(css).toContain('html[data-workspace-density="compact"] .lakay-density-aware .lakay-density-card');
    expect(css).toContain('html[data-workspace-density="compact"] .lakay-density-aware .lakay-density-prompt');
    expect(dashboard).toContain("lakay-density-aware");
    expect(dashboard).toContain("lakay-density-card");
    expect(newProject).toContain("lakay-density-aware");
    expect(newProject).toContain("lakay-density-prompt");
    expect(builder).toContain("lakay-density-aware");
  });
});
