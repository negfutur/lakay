import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("Builder Chat mobile containment", () => {
  it("constrains the Chat shell, message flow, and rich Markdown to the viewport", () => {
    expect(source).toContain("w-full min-w-0 max-w-full flex-col overflow-hidden");
    expect(source).toContain("w-full min-w-0 max-w-2xl space-y-7 overflow-x-hidden");
    expect(source).toContain("flex w-full min-w-0 max-w-full gap-2.5");
    expect(source).toContain("break-words [overflow-wrap:anywhere]");
    expect(source).toContain("prose-pre:max-w-full prose-pre:overflow-x-auto");
  });

  it("wraps task feedback and recovery controls instead of clipping them on a phone", () => {
    expect(source).toContain("basis-full break-words pl-5 leading-5");
    expect(source).toContain("inline-flex h-8 w-full items-center justify-center");
    expect(source).toContain("flex w-full min-w-0 max-w-2xl flex-wrap gap-2");
    expect(source).toContain("w-[calc(100%_-_1.5rem)] min-w-0 max-w-2xl");
    expect(source).toContain("min-h-12 max-h-28 w-full max-w-full");
  });

  it("keeps one preview action for an assistant reply", () => {
    expect((source.match(/hasPreviewAction && onOpenPreview/g) || [])).toHaveLength(1);
    expect(source).toContain("Voir l’aperçu");
  });
});
