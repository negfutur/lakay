import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./aiProvider", () => ({ invokeLakayProvider: vi.fn() }));

import { invokeLakayProvider } from "./aiProvider";
import { generateWebsiteFiles } from "./builderGeneration";
import { validateStaticBuild } from "./staticBuildValidation";

const project = {
  id: "repair-project",
  userId: 1,
  name: "Repairable site",
  description: "A static application used to verify Lakay's supported repair pipeline.",
  status: "ready" as const,
  generatedPlan: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const repairedBuild = {
  summary: "Repaired the missing active tab interaction.",
  files: [
    { path: "index.html", language: "html", content: "<!doctype html><html><body><main id='app'></main></body></html>" },
    { path: "styles.css", language: "css", content: "body { margin: 0; }" },
    { path: "data.js", language: "javascript", content: "window.LakayData = {};" },
    { path: "state.js", language: "javascript", content: "window.LakayState = { activeTab: 'home' };" },
    { path: "components.js", language: "javascript", content: "window.renderTab = () => {};" },
    { path: "app.js", language: "javascript", content: "window.renderTab(window.LakayState.activeTab);" },
  ],
};

afterEach(() => vi.clearAllMocks());

describe("Lakay static auto-fix generation pipeline", () => {
  it("normalizes, validates, and returns a persisted-build-ready replacement generated from a collected static issue", async () => {
    vi.mocked(invokeLakayProvider).mockResolvedValue({ choices: [{ message: { content: JSON.stringify(repairedBuild) } }] } as never);

    const result = await generateWebsiteFiles({
      project,
      instruction: "Auto-fix the supported static preview issue: ReferenceError: activeTab is not defined.",
      existingFiles: repairedBuild.files,
      projectContext: { files: [], capabilities: [], recentMemory: [] },
    });

    expect(vi.mocked(invokeLakayProvider).mock.calls[0]?.[0].messages[1]?.content).toContain("ReferenceError: activeTab is not defined");
    expect(result.summary).toBe(repairedBuild.summary);
    expect(result.files).toHaveLength(6);
    expect(validateStaticBuild(result.files)).toEqual({ valid: true, issues: [] });
  });
});
