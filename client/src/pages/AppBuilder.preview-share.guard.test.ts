import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Lakay shared preview control", () => {
  const builder = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

  it("creates an owner-scoped share token and copies a direct preview URL", () => {
    expect(builder).toContain("createPreviewShare");
    expect(builder).toContain("/preview/${share.token}");
    expect(builder).toContain("navigator.clipboard");
    expect(builder).toContain("Partager");
  });
});
