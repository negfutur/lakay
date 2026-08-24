import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/IosSigningPanel.tsx"), "utf8");

describe("Lakay iOS signing panel", () => {
  it("provides validated non-secret iOS signing references", () => {
    expect(source).toContain("Provisioning Profile");
    expect(source).toContain("Certificat de distribution Apple");
    expect(source).toContain("Apple Team ID");
    expect(source).toContain("Empreinte SHA-1 du certificat");
    expect(source).toContain("iOS runner not configured");
  });

  it("keeps real signing files and private material outside Lakay", () => {
    expect(source).toContain(".mobileprovision, .p12, mots de passe et clés privées ne sont jamais acceptés par Lakay");
    expect(source).toContain("coffre du runner macOS");
    expect(source).not.toContain('type="file"');
  });
});
