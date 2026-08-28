import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = () => readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("mobile preview actions", () => {
  it("keeps direct Open and Share actions available in both mobile preview and chat contexts", () => {
    const page = source();
    expect(page).toContain('aria-label="Partager l’aperçu"');
    expect(page).toContain('aria-label="Ouvrir l’aperçu"');
    expect(page).toContain('xl:hidden');
    expect(page).toContain('min-w-0 items-center justify-between gap-2');
    expect(page).toContain('previewVerified && <div className="flex shrink-0 items-center gap-1 md:hidden">');
  });

  it("does not reintroduce a second mobile preview title and device-control bar", () => {
    const page = source();
    expect(page).not.toContain('Aperçu de l’application <span');
  });
});
