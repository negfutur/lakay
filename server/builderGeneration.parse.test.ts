import { describe, expect, it } from "vitest";
import { parseWebsiteBuildContent } from "./builderGeneration";

describe("parseWebsiteBuildContent", () => {
  it("accepts structured JSON returned inside a model markdown fence", () => {
    expect(parseWebsiteBuildContent("```json\n{\"summary\":\"ok\",\"files\":[]}\n```"))
      .toEqual({ summary: "ok", files: [] });
  });

  it("rejects incomplete model output with a recoverable build message", () => {
    expect(() => parseWebsiteBuildContent('{"summary":"partial"')).toThrow("incomplete structured build response");
  });
});
