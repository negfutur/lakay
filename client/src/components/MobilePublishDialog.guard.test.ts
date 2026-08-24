import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/MobilePublishDialog.tsx"), "utf8");

describe("Lakay mobile publishing panel", () => {
  it("offers professional Android and iOS publication surfaces with source-version context", () => {
    expect(source).toContain("Publish Mobile App");
    expect(source).toContain('value="android"');
    expect(source).toContain('value="ios"');
    expect(source).toContain("Personal Use &amp; Limited Distribution");
    expect(source).toContain("You have unpackaged changes");
    expect(source).toContain("Version history");
    expect(source).toContain("Build APK");
  });

  it("keeps unavailable package and store states explicit until a scoped mobile runner delivers real artifacts", () => {
    expect(source).toContain("APK indisponible");
    expect(source).toContain("Publish to Google Play");
    expect(source).toContain("Android certificate SHA-1");
    expect(source).toContain("Les services backend, API et secrets associés");
    expect(source).toContain("La publication Play Console n’est pas encore connectée");
    expect(source).toContain("iOS runner not configured");
    expect(source).toContain("runner mobile isolé");
  });
});
