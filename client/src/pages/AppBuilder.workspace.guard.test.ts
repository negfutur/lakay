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
    expect(source).toContain('className="sticky top-0 z-30 flex h-12');
    expect(source).toContain(">Aperçu</button><button");
    expect(source).toContain(">Chat</button>");
  });

  it("provides responsive preview and truthful export controls", () => {
    expect(source).toContain("toggleFullscreen");
    expect(source).toContain("openPreview");
    expect(source).toContain("exportProject");
    expect(source).toContain("Project ZIP download started.");
    expect(source).toContain("GitHub");
    expect(source).toContain("À connecter");
    expect(source).toContain("MobilePublishDialog");
    expect(source).toContain(">Publish</span>");
    expect(source).toContain("requestAndroidBuild");
    expect(source).toContain("MobileBuildConfiguration");
    expect(source).toContain("Mobile build configuration prepared");
    expect(source).toContain("await prepareFullStack.mutateAsync");
    expect(source).not.toContain("Each build updates saved project files");
    expect(source).not.toContain("Project-aware builder assistant");
  });
});
