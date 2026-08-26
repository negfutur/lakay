import { describe, expect, it } from "vitest";
import { createRunnerScaffold, FULL_STACK_RUNNER_MANIFEST, validateFullStackRunnerManifest } from "../shared/runner";
import { createFullStackRunnerManifest } from "./runnerContract";

describe("Lakay full-stack runner contract", () => {
  it("accepts the safe runner manifest and generated unexecuted scaffold", () => {
    const manifest = { ...FULL_STACK_RUNNER_MANIFEST, scaffold: { files: createRunnerScaffold("Runner test") } };
    expect(validateFullStackRunnerManifest(manifest)).toEqual([]);
  });

  it("produces a full-stack client, API, database, and non-secret project blueprint", () => {
    const files = createRunnerScaffold("Runner test", "A protected scheduling application.");
    const byPath = new Map(files.map(file => [file.path, file.content]));
    expect(byPath.get("lakay.project.json")).toContain("protected scheduling application");
    expect(byPath.get("lakay.api-contract.json")).toContain("/api/records");
    expect(byPath.get("lakay.api-contract.json")).toContain("project_scoped");
    expect(byPath.get("mobile/app.json")).toContain("com.lakay");
    expect(byPath.get("mobile/eas.json")).toContain("app-bundle");
    expect(byPath.get("mobile/App.tsx")).toContain("from 'react-native'");
    expect(byPath.get("package.json")).toContain("mysql2");
    expect(byPath.get(".env.example")).toContain("DATABASE_URL");
    expect(byPath.get("DEPLOYMENT_CHECKLIST.md")).toContain("Do not run unreviewed generated code");
    expect(byPath.get("client/index.html")).toContain("root");
    expect(byPath.get("server/index.ts")).toContain("/api/health");
    expect(byPath.get("server/routes/app.ts")).toContain("appRouter");
    expect(byPath.get("drizzle/schema.ts")).toContain("mysqlTable");
    expect(byPath.get("README.runner.md")).toContain("runner-scoped secrets");
  });

  it("creates distinct web and mobile release contracts with explicit target metadata", () => {
    const web = createFullStackRunnerManifest("Web application", "A browser product", [], undefined, "web");
    const mobile = createFullStackRunnerManifest("Mobile application", "A touch-first product", [], { appName: "Mobile application", version: "1.0.0", bundleId: "com.lakay.mobile" }, "mobile");
    expect(web.projectKind).toBe("web_application");
    expect(mobile.projectKind).toBe("mobile_application");
    expect(mobile.scaffold.files.find(file => file.path === "lakay.project.json")?.content).toContain('"target": "mobile"');
    expect(mobile.scaffold.files.find(file => file.path === "mobile/app.json")?.content).toContain('"sourceTarget": "mobile"');
    expect(mobile.scaffold.files.find(file => file.path === "DEPLOYMENT_CHECKLIST.md")?.content).toContain("EAS webhook");
  });

  it("rejects unsafe scaffold paths, duplicate files, and missing runner isolation", () => {
    const manifest = {
      ...FULL_STACK_RUNNER_MANIFEST,
      isolation: { ...FULL_STACK_RUNNER_MANIFEST.isolation, network: "allow_all" as never },
      scaffold: { files: [
        { ...createRunnerScaffold("Runner test")[0], path: "../secrets.ts" },
        { ...createRunnerScaffold("Runner test")[0], path: "../secrets.ts" },
      ] },
    };
    const issues = validateFullStackRunnerManifest(manifest);
    expect(issues.join(" ")).toMatch(/isolation|Unsafe runner scaffold path|Duplicate runner scaffold path/);
  });
});
