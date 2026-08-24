import { describe, expect, it, vi } from "vitest";

const { invokeLakayWithFallback } = vi.hoisted(() => ({ invokeLakayWithFallback: vi.fn() }));
vi.mock("./projectPlanning", () => ({ invokeLakayWithFallback }));

import { generateWebsiteFiles } from "./builderGeneration";

const completeBuild = {
  summary: "A focused reservation experience.",
  files: {
    "index.html": "<!doctype html><html><head><link rel=\"stylesheet\" href=\"styles.css\"></head><body><main id=\"app\"></main><script src=\"data.js\"></script><script src=\"state.js\"></script><script src=\"components.js\"></script><script src=\"app.js\"></script></body></html>",
    "styles.css": "@media (max-width: 700px){main{padding:1rem}}",
    "data.js": "window.DATA={slots:[\"09:00\"]};",
    "state.js": "window.STATE={selected:null};",
    "components.js": "window.Components={};",
    "app.js": "document.querySelector('#app').textContent='Reservation';",
  },
};

describe("Lakay build quality contract", () => {
  it("asks the model for an authored visual direction and complete primary workflow", async () => {
    invokeLakayWithFallback.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(completeBuild) } }] });
    await generateWebsiteFiles({
      project: { id: "quality-project", userId: 1, name: "Atelier", description: "Application web : réserver un cours d’artisanat", status: "ready", generatedPlan: null, createdAt: new Date(), updatedAt: new Date() },
      instruction: "Crée la première version.",
      projectContext: { files: [], capabilities: [], recentMemory: [] },
    });
    const systemPrompt = invokeLakayWithFallback.mock.calls[0]?.[0]?.messages?.[0]?.content ?? "";
    expect(systemPrompt).toContain("primary user");
    expect(systemPrompt).toContain("deliberate visual direction");
    expect(systemPrompt).toContain("Do not leave stub files");
    expect(systemPrompt).toContain("small-screen adaptation");
  });
});
