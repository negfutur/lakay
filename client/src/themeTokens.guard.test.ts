import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./index.css", import.meta.url), "utf8");
const app = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

describe("Lakay appearance theme tokens", () => {
  it("defines distinct root light and dark token blocks", () => {
    expect(css).toContain(":root {");
    expect(css).toContain(".dark {");
    expect(css).toContain("--background: oklch(0.97");
    expect(css).toContain("--background: oklch(0.09");
  });

  it("enables the theme provider’s persisted switching behavior", () => {
    expect(app).toContain('ThemeProvider defaultTheme="dark" switchable');
  });
});
