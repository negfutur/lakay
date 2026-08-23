import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const builder = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay preview transition optimization", () => {
  it("keeps the existing preview mounted while generation or finalization is active", () => {
    expect(builder).toContain("const [isPreviewTransitioning, setIsPreviewTransitioning] = useState(false);");
    expect(builder).toContain("const previewBusy = isGenerating || isPreviewTransitioning;");
    expect(builder).toContain("{hasBuild ? <iframe");
    expect(builder).toContain("opacity-60");
    expect(builder).not.toContain("{isGenerating ? <div className=\"grid h-[440px]");
  });

  it("moves to preview before waiting for the builder refresh and clears the finalization state safely", () => {
    expect(builder).toContain('setMobilePane("preview");\n      setIsPreviewTransitioning(true);');
    expect(builder).toContain("await refreshBuilder(\"Build completed. Live preview updated from generated project files.\")");
    expect(builder).toContain("finally {\n        setIsPreviewTransitioning(false);");
    expect(builder).toContain("Aperçu final en préparation");
  });
});
