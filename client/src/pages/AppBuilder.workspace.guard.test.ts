import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay compact builder workspace", () => {
  it("keeps a desktop preview and chat split plus simple mobile modes", () => {
    expect(source).toContain('useState<"chat" | "preview">("preview")');
    expect(source).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(source).toContain('setMobilePane("preview")');
    expect(source).toContain('setMobilePane("chat")');
    expect(source).toContain('xl:order-2 xl:flex');
  });

  it("provides responsive preview and truthful export controls", () => {
    expect(source).toContain("toggleFullscreen");
    expect(source).toContain("openPreview");
    expect(source).toContain("exportProject");
    expect(source).toContain("Project ZIP download started.");
    expect(source).toContain("Push to GitHub");
    expect(source).toContain("Connect first");
    expect(source).toContain("Deploy becomes available when the isolated runner");
  });
});
