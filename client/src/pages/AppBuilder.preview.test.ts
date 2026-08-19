import { describe, expect, it } from "vitest";
import { makePreviewDocument } from "../lib/staticPreview";

const baseFiles = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><head></head><body><main id='app'>Original</main></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "button { background: black; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.render = () => {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "window.render();" },
];

describe("Lakay sandbox preview refresh source", () => {
  it("creates a new isolated preview document when persisted generated files change", () => {
    const before = makePreviewDocument(baseFiles);
    const after = makePreviewDocument(baseFiles.map(file => file.path === "styles.css" ? { ...file, content: "button { background: blue; }" } : file));

    expect(before).toContain("background: black");
    expect(after).toContain("background: blue");
    expect(after).not.toBe(before);
    expect(after).toContain("Content-Security-Policy");
  });
});
