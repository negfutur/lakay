import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./AIChatBox.tsx", import.meta.url), "utf8");

describe("Builder Chat conversational message styling", () => {
  it("renders user messages as distinct right-aligned bubbles with an avatar and no raw role label", () => {
    expect(source).toContain('message.role === "user" ? "justify-end" : "justify-start"');
    expect(source).toContain("rounded-2xl rounded-br-md");
    expect(source).toContain("<UserRound className=\"size-3.5\" />");
    expect(source).not.toContain('tracking-[0.16em] text-violet-100/60">Vous</p>');
  });

  it("keeps assistant replies quietly separated and gives conversations measured vertical breathing room", () => {
    expect(source).toContain("space-y-7 overflow-x-hidden px-4 py-6");
    expect(source).toContain("border-t border-white/[0.055] pt-3");
    expect(source).toContain("sm:max-w-[90%]");
  });
});
