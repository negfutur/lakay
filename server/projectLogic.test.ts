import { describe, expect, it } from "vitest";
import { normalizeProjectPlan, projectBelongsToUser } from "./projectLogic";

describe("Lakay project plan normalization", () => {
  it("keeps valid structured planning output while removing empty list values", () => {
    const plan = normalizeProjectPlan({
      name: "Northstar",
      tagline: "A clearer planning workspace.",
      summary: "An app for shaping product direction.",
      goals: ["Focus", "", "Alignment"],
      features: ["Project brief"],
      techStack: [{ category: "Frontend", name: "React", reason: "Fast interfaces" }],
      components: [{ name: "Brief editor", purpose: "Captures product context" }],
      milestones: ["Scope the release"],
    });

    expect(plan.name).toBe("Northstar");
    expect(plan.goals).toEqual(["Focus", "Alignment"]);
    expect(plan.techStack[0]).toMatchObject({ name: "React" });
  });

  it("provides a usable plan when the AI response is malformed or incomplete", () => {
    const plan = normalizeProjectPlan({ name: "", components: [{ name: "", purpose: "" }] });

    expect(plan.name).toBe("Untitled project");
    expect(plan.features.length).toBeGreaterThan(0);
    expect(plan.components[0]?.name).toBe("Product component");
  });
});

describe("Lakay project ownership", () => {
  it("allows a project operation only for its owning authenticated user", () => {
    expect(projectBelongsToUser(42, 42)).toBe(true);
    expect(projectBelongsToUser(42, 7)).toBe(false);
  });
});
