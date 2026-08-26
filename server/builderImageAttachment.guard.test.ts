import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const builder = readFileSync(resolve(process.cwd(), "server/builder.ts"), "utf8");
const generator = readFileSync(resolve(process.cwd(), "server/builderGeneration.ts"), "utf8");
const gemini = readFileSync(resolve(process.cwd(), "server/gemini.ts"), "utf8");
const chat = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("Builder image-assisted prompt guard", () => {
  it("keeps images project-scoped, bounded, and server-side before generation", () => {
    expect(builder).toContain("uploadPromptImage");
    expect(builder).toContain("builder-attachments/${ctx.user.id}/${input.projectId}/");
    expect(builder).toContain("bytes.byteLength > 5_000_000");
    expect(builder).toContain("getOwnedPromptImageDataUrl");
    expect(builder).toContain("imageKey: z.string().min(10).max(500).optional()");
  });

  it("preserves visual references for Gemini without allowing copied branded output", () => {
    expect(gemini).toContain("inlineData");
    expect(generator).toContain("referenceImageDataUrl");
    expect(generator).toContain("do not copy brands, logos, private text, or protected artwork");
  });

  it("shows a bounded image picker in the Builder prompt", () => {
    expect(chat).toContain("accept=\"image/jpeg,image/png,image/webp\"");
    expect(chat).toContain("Choisissez une image de 5 Mo maximum.");
    expect(chat).toContain("onUploadImage?: (file: File) => Promise<string>");
  });
});
