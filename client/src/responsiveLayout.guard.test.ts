import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const source = (relativePath: string) => readFileSync(join(projectRoot, relativePath), "utf8");

describe("Lakay responsive layout guard", () => {
  it("does not hide horizontal overflow globally and constrains the application shell", () => {
    const css = source("client/src/index.css");
    const shell = source("client/src/components/DashboardLayout.tsx");

    expect(css).not.toContain("overflow-x: clip");
    expect(css).toContain("#root { min-width: 0; max-width: 100%; }");
    expect(shell).toContain("min-h-screen min-w-0 bg-[#0b0b10]");
    expect(shell).toContain("<main className=\"min-h-screen min-w-0\">");
  });

  it("keeps primary mobile pages free of viewport-width layout traps", () => {
    const landing = source("client/src/pages/Landing.tsx");
    const newProject = source("client/src/pages/NewProject.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");

    for (const page of [landing, newProject, dashboard]) {
      expect(page).not.toContain("w-screen");
      expect(page).not.toContain("min-w-screen");
      expect(page).not.toContain("100vw");
    }
    expect(newProject).toContain("px-4 py-4");
    expect(dashboard).toContain("grid grid-cols-2 gap-3");
  });

  it("bounds the live builder preview and collapses its tabs for narrow screens", () => {
    const builder = source("client/src/pages/AppBuilder.tsx");
    const sidebar = source("client/src/components/ui/sidebar.tsx");

    expect(builder).toContain("w-[390px] max-w-full");
    expect(builder).toContain("overflow-x-auto");
    expect(builder).toContain("<span className=\"hidden sm:inline\">{tab.label}</span>");
    expect(builder).toContain("!h-[20rem]");
    expect(sidebar).toContain('const SIDEBAR_WIDTH_MOBILE = "min(18rem, calc(100vw - 2rem))"');
  });
});
