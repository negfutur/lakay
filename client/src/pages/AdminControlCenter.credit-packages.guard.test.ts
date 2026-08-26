import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AdminControlCenter.tsx", import.meta.url), "utf8");

describe("Lakay administrator credit package preparation", () => {
  it("keeps package preparation inside the administrator control center and labels Checkout as inactive", () => {
    expect(source).toContain("trpc.admin.creditPackageDrafts.useQuery");
    expect(source).toContain("trpc.admin.saveCreditPackageDraft.useMutation");
    expect(source).toContain("Checkout inactif");
    expect(source).toContain("Price ID réel (optionnel)");
    expect(source).toContain("aucun brouillon ne met un pack en vente");
  });
});
