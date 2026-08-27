import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder standalone preview return guard", () => {
  it("closes the preview tab back to the existing Lakay workspace before using a safe route fallback", () => {
    expect(source).toContain("const standaloneReturnBridge");
    expect(source).toContain("window.close()");
    expect(source).toContain("window.location.replace(destination)");
    expect(source).toContain("standalonePreviewDocument");
    expect(source).toContain("popup.opener = null");
  });
});
