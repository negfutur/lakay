import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder preview readiness guard", () => {
  it("does not expose an unverified generated preview as ready or openable", () => {
    expect(source).toContain('const [previewReadiness, setPreviewReadiness] = useState<"idle" | "checking" | "ready" | "failed">("idle")');
    expect(source).toContain('const previewVerified = hasBuild && previewReadiness === "ready" && runtimeIssues.length === 0');
    expect(source).toContain('if (data.type === "render-ready")');
    expect(source).toContain('if (!previewVerified) return toast.error("L’aperçu n’est pas encore vérifié. Attendez sa confirmation ou corrigez le problème détecté.")');
    expect(source).toContain('if (!previewVerified) return toast.error("L’aperçu doit être vérifié avant de pouvoir être partagé.")');
  });
});
