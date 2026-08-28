import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Lakay local mobile source export", () => {
  it("prepares and includes the isolated full-stack blueprint with deployment guidance", () => {
    expect(source).toContain("await prepareFullStack.mutateAsync({ projectId })");
    expect(source).toContain("manifest.scaffold.files.forEach");
    expect(source).toContain('archive.file("DEPLOYMENT.md"');
    expect(source).toContain('archive.file("EXPORT_READINESS.md"');
    expect(source).toContain("DEPLOYMENT_CHECKLIST.md");
    expect(source).toContain(".env.example");
    expect(source).toContain("static-preview/${file.path}");
    expect(source).toContain("Do not run unreviewed user code on the Lakay control-plane server.");
  });

  it("bundles an Expo/EAS source target with truthful mobile artifact guidance", () => {
    expect(source).toContain("LOCAL_MOBILE_BUILD.md");
    expect(source).toContain("Expo and EAS mobile build");
    expect(source).toContain("eas build --platform android --profile preview");
    expect(source).toContain("it is **not** a precompiled APK, AAB, or IPA.");
    expect(source).toContain("projectTarget === \"mobile\" ? \"mobile\" : \"web\"");
  });

  it("connects the in-dialog download action to the existing source ZIP exporter", () => {
    expect(source).toContain('window.addEventListener("lakay-download-source"');
    expect(source).toContain("void exportProject()");
  });

  it("routes publication through the single project-scoped publication center", () => {
    expect(source).toContain('navigate(`/projects/${projectId}/publish`)');
    expect(source).not.toContain('navigate(`/projects/${projectId}/publish/web`)');
    expect(source).not.toContain('navigate(`/projects/${projectId}/publish/mobile`)');
    expect(source).not.toContain('navigate(`/projects/${projectId}/publish/desktop`)');
  });
});
