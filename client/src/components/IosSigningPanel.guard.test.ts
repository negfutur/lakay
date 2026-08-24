import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/IosSigningPanel.tsx"), "utf8");

describe("Lakay iOS signing panel", () => {
  it("provides clear Xcode and App Store publication choices", () => {
    expect(source).toContain("Télécharger les sources Xcode");
    expect(source).toContain("TestFlight / App Store");
    expect(source).toContain("Apple Team ID");
    expect(source).toContain("Profil de publication");
  });

  it("keeps publication material outside the interface", () => {
    expect(source).toContain("compte Apple");
    expect(source).not.toContain('type="file"');
  });
});
