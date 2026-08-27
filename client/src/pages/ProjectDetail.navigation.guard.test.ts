import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const routes = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("./ProjectDetail.tsx", import.meta.url), "utf8");

describe("Builder return navigation", () => {
  it("keeps the Builder return destination registered as a project brief route", () => {
    expect(routes).toContain('path="/projects/:projectId/brief" component={ProjectDetail}');
    expect(builder).toContain('navigate(`/projects/${projectId}/brief`)');
  });

  it("extracts the project id from the exact brief route before loading protected project data", () => {
    expect(detail).toContain('useRoute("/projects/:projectId/brief")');
    expect(detail).toContain("briefParams?.projectId ?? legacyParams?.projectId");
  });
});
