import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay compact builder workspace", () => {
  it("keeps a desktop preview and chat split plus simple mobile modes", () => {
    expect(source).toContain('useState<"chat" | "preview">("preview")');
    expect(source).toContain('md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(source).toContain('setMobilePane("preview")');
    expect(source).toContain('setMobilePane("chat")');
    expect(source).toContain('md:order-2 md:flex');
    expect(source).toContain("<DashboardLayout lockViewport>");
    expect(source).toContain("h-full min-h-0 flex-col overflow-hidden overscroll-contain");
    expect(source).toContain("conversationStatus");
    expect(source).toContain(">Aperçu</button><button");
    expect(source).toContain(">Chat</button>");
  });

  it("provides responsive preview and truthful export controls", () => {
    expect(source).toContain("toggleFullscreen");
    expect(source).toContain("openPreview");
    expect(source).toContain("exportProject");
    expect(source).toContain("Export full-stack prêt au téléchargement.");
    expect(source).toContain('aria-label="Actions du workspace"');
    expect(source).toContain("Terminal");
    expect(source).toContain("Plein écran");
    expect(source).toContain("MobilePublishDialog");
    expect(source).toContain("Publier");
    expect(source).toContain("requestAndroidBuild");
    expect(source).toContain("MobileBuildConfiguration");
    expect(source).toContain("Mobile build configuration prepared");
    expect(source).toContain("await prepareFullStack.mutateAsync");
    expect(source).not.toContain("Each build updates saved project files");
    expect(source).not.toContain("Project-aware builder assistant");
    expect(source).not.toContain("PreviewQuickActions onRefresh");
  });
});
