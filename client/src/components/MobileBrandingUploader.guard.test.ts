import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/MobileBrandingUploader.tsx"), "utf8");

describe("Lakay mobile branding uploader", () => {
  it("accepts only validated PNG assets with app-icon and splash-screen dimension safeguards", () => {
    expect(source).toContain('accept="image/png"');
    expect(source).toContain('file.type !== "image/png"');
    expect(source).toContain("file.size > 4 * 1024 * 1024");
    expect(source).toContain("dimensions.width === dimensions.height");
    expect(source).toContain("dimensions.width >= 720 && dimensions.height >= 720");
  });

  it("uses the user-selected file only through the authenticated upload callback", () => {
    expect(source).toContain("await onUpload({ kind, filename: file.name, dataUrl })");
    expect(source).toContain("asset.url");
    expect(source).not.toContain("fetch(");
  });
});
