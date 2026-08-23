import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");
const main = readFileSync(new URL("../main.tsx", import.meta.url), "utf8");
const projects = readFileSync(new URL("../../../server/projects.ts", import.meta.url), "utf8");

describe("Lakay truthful build failure recovery", () => {
  it("detects non-JSON API responses before tRPC attempts to parse HTML", () => {
    expect(main).toContain('contentType.includes("application/json")');
    expect(main).toContain("Lakay API returned an unexpected response");
  });

  it("never presents a failed build as complete and exposes a retry that preserves the preview", () => {
    expect(builder).toContain("getBuildFailureMessage");
    expect(builder).toContain("setBuildFailure(failureMessage)");
    expect(builder).toContain("Réessayer");
    expect(builder).toContain("activeBuildRef");
    expect(builder).toContain("const isRetry");
    expect(builder).toContain("originalIdea");
    expect(builder).toContain("L’aperçu apparaîtra ici.");
    expect(builder).toContain("Lakay ne marque l’application comme terminée");
    expect(builder).toContain('setMobilePane("chat")');
  });

  it("describes a new project as configured rather than already generated", () => {
    expect(projects).toContain("L’application n’est pas encore générée");
    expect(projects).toContain("bouton **Créer**");
  });
});
