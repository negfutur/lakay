import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");

describe("compact Builder Chat flow", () => {
  it("keeps normal messages flat and reserves elevated cards for meaningful task and recovery states", () => {
    expect(source).toContain('message.role === "user" ? "justify-end" : "justify-start"');
    expect(source).toContain('rounded-2xl rounded-br-md border border-violet-200/15');
    expect(source).toContain('mx-auto w-full max-w-2xl space-y-7');
    expect(source).toContain('mx-auto mb-3 mt-2 w-[calc(100%-1.5rem)] max-w-2xl');
    expect(source).toContain('message.role === "assistant"');
    expect(source).not.toContain('border-l border-violet-300/35 py-0.5 pl-3 text-left text-violet-100');
    expect(source).toContain("{backgroundTask ? (");
    expect(source).toContain("{error ? (");
  });

  it("uses a discrete natural working indicator and keeps technical stages behind details", () => {
    expect(source).toContain("Lakay travaille…");
    expect(source).toContain("Voir les détails");
    expect(source).not.toContain("Détails du traitement");
  });
});
