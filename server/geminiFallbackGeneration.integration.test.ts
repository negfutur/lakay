import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", async importOriginal => {
  const actual = await importOriginal<typeof import("./_core/llm")>();
  return { ...actual, invokeLLM: vi.fn(), listLLMModels: vi.fn() };
});
vi.mock("./gemini", () => ({
  isGeminiConfigured: vi.fn(() => true),
  invokeGemini: vi.fn(),
  invokeGeminiStream: vi.fn(),
}));

import { invokeLLM, listLLMModels, LlmProviderQuotaError } from "./_core/llm";
import { invokeGemini } from "./gemini";
import { generateWebsiteFiles } from "./builderGeneration";
import { validateStaticBuild } from "./staticBuildValidation";

const geminiBuild = {
  summary: "Gemini generated the landing page files after the built-in provider quota was exhausted.",
  files: [
    { path: "index.html", content: "<!doctype html><html><body><main id='app'></main></body></html>" },
    { path: "styles.css", content: "body { margin: 0; background: #111; }" },
    { path: "data.js", content: "window.LakayData = { title: 'Gemini build' };" },
    { path: "state.js", content: "window.LakayState = {};" },
    { path: "components.js", content: "window.render = () => {};" },
    { path: "app.js", content: "window.render();" },
  ],
};

afterEach(() => vi.clearAllMocks());

describe("Lakay Gemini generated-file fallback", () => {
  it("uses Gemini after built-in quota exhaustion and returns validated files ready for protected persistence", async () => {
    vi.mocked(listLLMModels).mockResolvedValue({ object: "list", data: [{ id: "gpt-5" }] } as never);
    vi.mocked(invokeLLM).mockRejectedValueOnce(new LlmProviderQuotaError("usage exhausted", 9));
    vi.mocked(invokeGemini).mockResolvedValue({ id: "gemini-build", created: 1, model: "gemini-3.6-flash", choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(geminiBuild) }, finish_reason: "stop" }] } as never);

    const result = await generateWebsiteFiles({
      project: { id: "gemini-project", userId: 1, name: "Gemini fallback site", description: "A landing page.", status: "ready", generatedPlan: null, createdAt: new Date(), updatedAt: new Date() },
      instruction: "Create a landing page for my business.",
      projectContext: { files: [], capabilities: [], recentMemory: [] },
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(invokeGemini).toHaveBeenCalledTimes(1);
    expect(result.summary).toContain("Gemini generated");
    expect(validateStaticBuild(result.files)).toEqual({ valid: true, issues: [] });
  });
});
