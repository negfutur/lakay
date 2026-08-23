import { describe, expect, it } from "vitest";
import { generateWebsiteFiles } from "./builderGeneration";
import { validateStaticBuild } from "./staticBuildValidation";

const runRealBuilderCheck = process.env.RUN_REAL_GEMINI_BUILDER_TEST === "1";

describe("real Gemini Lakay website build", () => {
  it.skipIf(!runRealBuilderCheck)("returns a valid complete static website build", async () => {
    const result = await generateWebsiteFiles({
      project: {
        id: "real-gemini-verification",
        userId: 1,
        name: "Atelier local",
        description: "Application web : Une page de réservation pour un petit atelier local.",
        status: "ready",
        generatedPlan: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      instruction: "Crée une première version compacte avec une présentation, des créneaux et un formulaire de réservation.",
      projectContext: { files: [], capabilities: [], recentMemory: [] },
    });

    expect(validateStaticBuild(result.files)).toEqual({ valid: true, issues: [] });
    expect(result.files.map(file => file.path)).toEqual(["index.html", "styles.css", "data.js", "state.js", "components.js", "app.js"]);
  }, 150_000);
});
