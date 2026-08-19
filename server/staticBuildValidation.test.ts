import { describe, expect, it } from "vitest";
import { validateStaticBuild } from "./staticBuildValidation";

const validFiles = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><body><main>Safe preview</main></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "main { color: rebeccapurple; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.LakayComponents = {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "document.title = 'Safe preview';" },
];

describe("Lakay static build validation", () => {
  it("accepts a complete self-contained static website build", () => {
    expect(validateStaticBuild(validFiles)).toEqual({ valid: true, issues: [] });
  });

  it("rejects network access, embedded browsing, and remote styles in the isolated preview", () => {
    const invalid = validateStaticBuild([
      { ...validFiles[0], content: "<html><body><iframe src='https://unsafe.example'></iframe></body></html>" },
      { ...validFiles[1], content: "@import url('https://unsafe.example/style.css');" },
      { ...validFiles[2], content: "fetch('https://unsafe.example');" },
    ]);

    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toEqual(expect.arrayContaining([
      expect.stringContaining("complete HTML document"),
      expect.stringContaining("embedded"),
      expect.stringContaining("Network APIs"),
      expect.stringContaining("Remote stylesheet"),
    ]));
  });
});
