import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "server/projects.ts"), "utf8");

describe("first-build acknowledgement truthfulness", () => {
  it("does not expose an unverified preview or planned full-stack capability as a delivered feature", () => {
    expect(source).toContain("Je vous montrerai l’aperçu seulement après validation de la première version.");
    expect(source).toContain("resteront indiquées comme prévues jusqu’à leur vérification dans un environnement full-stack");
    expect(source).not.toContain("Je vous montre l’aperçu dès que la première version est prête");
  });
});
