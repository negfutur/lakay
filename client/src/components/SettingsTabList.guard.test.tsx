// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Palette, UserRound } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsTabList } from "./SettingsTabList";

const tabs = [
  { id: "profile", label: "Profil", note: "Identité", icon: UserRound },
  { id: "appearance", label: "Apparence", note: "Préférences", icon: Palette },
];

afterEach(cleanup);

describe("SettingsTabList", () => {
  it("moves focus and activates adjacent settings sections with arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsTabList tabs={tabs} activeTab="profile" onChange={onChange} />);
    const profile = screen.getByRole("tab", { name: /profil/i });
    profile.focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("appearance");
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: /apparence/i }));
  });

  it("marks the active section for assistive technology and accepts click activation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SettingsTabList tabs={tabs} activeTab="profile" onChange={onChange} />);
    expect(screen.getByRole("tab", { name: /profil/i }).getAttribute("aria-selected")).toBe("true");
    await user.click(screen.getByRole("tab", { name: /apparence/i }));
    expect(onChange).toHaveBeenCalledWith("appearance");
  });
});
