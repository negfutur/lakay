// @vitest-environment jsdom
import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { AppearanceThemeChoices } from "./WorkspaceSettings";

afterEach(cleanup);

function ThemeFixture() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  return <><output aria-label="selected theme">{theme}</output><AppearanceThemeChoices theme={theme} setTheme={setTheme} /></>;
}

describe("Lakay Appearance theme choices", () => {
  it("changes the rendered theme state when a user selects light or dark mode", async () => {
    const user = userEvent.setup();
    render(<ThemeFixture />);
    expect(screen.getByLabelText("selected theme").textContent).toBe("dark");
    await user.click(screen.getByRole("button", { name: /clair/i }));
    expect(screen.getByLabelText("selected theme").textContent).toBe("light");
    expect(screen.getByRole("button", { name: /clair/i }).getAttribute("aria-pressed")).toBe("true");
    await user.click(screen.getByRole("button", { name: /sombre/i }));
    expect(screen.getByLabelText("selected theme").textContent).toBe("dark");
  });
});
