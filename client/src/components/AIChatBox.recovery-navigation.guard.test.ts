import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("Builder Chat recovery and latest-message navigation", () => {
  it("renders recoverable errors as a quiet inline status with accessible detail and retry", () => {
    expect(source).toContain('role="status" aria-live="polite"');
    expect(source).toContain("Voir le détail");
    expect(source).toContain('isLoading ? "Relance…" : "Réessayer"');
    expect(source).toContain("Aucun crédit n’a été prélevé.");
    expect(source).not.toContain("rounded-2xl border border-rose-300/18");
  });

  it("lets readers return immediately to the latest message even without newly arrived content", () => {
    expect(source).toContain("const [isAwayFromLatest, setIsAwayFromLatest] = useState(false)");
    expect(source).toContain("setIsAwayFromLatest(!isNearBottomRef.current)");
    expect(source).toContain('hasUnreadMessages || isAwayFromLatest');
    expect(source).toContain('"Revenir au dernier message"');
    expect(source).toContain("<ArrowDown className=\"size-3\" />");
  });
});
