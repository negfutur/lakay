import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const chat = fs.readFileSync(path.resolve(process.cwd(), "client/src/components/AIChatBox.tsx"), "utf8");
const agent = fs.readFileSync(path.resolve(process.cwd(), "server/projectAgent.ts"), "utf8");
const styles = fs.readFileSync(path.resolve(process.cwd(), "client/src/index.css"), "utf8");
const builder = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/AppBuilder.tsx"), "utf8");

describe("Builder desktop experience", () => {
  it("does not persist internal agent assessment as a Builder instruction and hides legacy leaked assessment messages", () => {
    expect(agent).toContain("return instruction;");
    expect(agent).not.toContain("return `${instruction}\\n\\nContexte interne Lakay");
    expect(chat).toContain("Contexte interne Lakay");
  });

  it("keeps a compact desktop control hierarchy and never hides the verified preview canvas", () => {
    expect(styles).toContain(".lakay-preview-main > div:nth-of-type(2) { display: none; }");
    expect(styles).not.toContain(".lakay-preview-main > div:nth-of-type(4) > div:first-child { display: none; }");
    expect(styles).toContain('iframe[title="Generated Lakay application preview"]');
    expect(styles).toContain("height: calc(100dvh - 10.5rem) !important;");
    expect(builder).toContain('rounded-full bg-white/[0.055] p-0.5 md:hidden');
    expect(builder).toContain("lakay-preview-main relative h-full");
  });
});
