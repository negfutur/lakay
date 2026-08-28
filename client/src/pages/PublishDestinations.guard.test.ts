import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("publication destinations", () => {
  it("registers separate Web, Mobile, and Desktop publication routes", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('/projects/:projectId/publish/web');
    expect(app).toContain('/projects/:projectId/publish/mobile');
    expect(app).toContain('/projects/:projectId/publish/desktop');
    expect(app).toContain('component={PublishCenterPage}');
  });

  it("keeps distinct premium publication pages inside the single Builder publication center", () => {
    const builder = read("client/src/pages/AppBuilder.tsx");
    const center = read("client/src/pages/PublishCenterPage.tsx");
    expect(builder).toContain('Centre de publication');
    expect(builder).not.toContain('navigate(`/projects/${projectId}/publish/web`)');
    expect(builder).not.toContain('navigate(`/projects/${projectId}/publish/mobile`)');
    expect(builder).not.toContain('navigate(`/projects/${projectId}/publish/desktop`)');
    expect(center).toContain('Web App');
    expect(center).toContain('Mobile App');
    expect(center).toContain('Ordinateur');
  });
});
