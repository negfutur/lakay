import { describe, expect, it } from "vitest";
import { createBuildProjectContext } from "./projectBuildContext";

describe("Lakay incremental build context", () => {
  it("makes the senior incremental execution policy available to every follow-up build", () => {
    const context = createBuildProjectContext([{ path: "app.js", language: "javascript", content: "document.addEventListener('click', () => {})" }] as never);
    expect(context.executionPolicy).toContain("preserve working workflows");
    expect(context.executionPolicy).toContain("Never restart from a blank template");
  });
});
