import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("compact Builder Chat flow", () => {
  it("keeps normal messages flat and reserves elevated cards for meaningful task and recovery states", () => {
    expect(source).toContain('message.role === "user"\n                          ? "py-1 text-right text-violet-100"');
    expect(source).toContain('message.role === "assistant"');
    expect(source).not.toContain('rounded-[1.35rem] rounded-br-md border border-violet-200/15');
    expect(source).toContain("{backgroundTask ? (");
    expect(source).toContain("{error ? (");
  });

  it("uses a discrete natural working indicator and keeps technical stages behind details", () => {
    expect(source).toContain("Lakay travaille…");
    expect(source).toContain("Voir les détails");
    expect(source).not.toContain("Détails du traitement");
  });
});
