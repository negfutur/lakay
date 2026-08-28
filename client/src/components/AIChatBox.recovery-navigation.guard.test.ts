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
    expect(source).toContain("isLoading && showLoadingIndicator && !backgroundTask");
    expect(source).not.toContain("rounded-2xl border border-rose-300/18");
  });

  it("keeps active background work compact so it does not block Lakay’s reply or preview result", () => {
    expect(source).toContain('className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-1 border-t');
    expect(source).toContain("Lakay travaille");
    expect(source).toContain("backgroundTask.progress");
    expect(source).toContain(">Annuler</button>");
    expect(source).not.toContain("La tâche est sauvegardée et reprendra si vous revenez plus tard.");
  });

  it("lets readers return immediately to the latest message even without newly arrived content", () => {
    expect(source).toContain("const [isAwayFromLatest, setIsAwayFromLatest] = useState(false)");
    expect(source).toContain("setIsAwayFromLatest(!isNearBottomRef.current)");
    expect(source).toContain('hasUnreadMessages || isAwayFromLatest');
    expect(source).toContain('"Revenir au dernier message"');
    expect(source).toContain("<ArrowDown className=\"size-3 shrink-0\" />");
  });
});
