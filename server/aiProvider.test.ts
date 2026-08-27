import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectPlanning", () => ({ invokeLakayWithFallback: vi.fn() }));

import { invokeLakayWithFallback } from "./projectPlanning";
import { invokeLakayProvider } from "./aiProvider";

describe("Lakay provider-neutral routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a conversational capability through a server-side provider policy", async () => {
    vi.mocked(invokeLakayWithFallback).mockResolvedValue({ choices: [{ message: { content: "Bonjour." }, finish_reason: "stop" }] } as never);
    await invokeLakayProvider({ messages: [{ role: "user", content: "Bonjour" }] }, { task: "conversation" });
    expect(invokeLakayWithFallback).toHaveBeenCalledWith(expect.objectContaining({ preferGemini: false, geminiRoute: "followup" }));
  });

  it("routes an initial build through the multimodal-capable policy without exposing a provider to the Builder", async () => {
    vi.mocked(invokeLakayWithFallback).mockResolvedValue({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] } as never);
    await invokeLakayProvider({ messages: [{ role: "user", content: "Construis une V1" }] }, { task: "build_initial" });
    expect(invokeLakayWithFallback).toHaveBeenCalledWith(expect.objectContaining({ preferGemini: true, geminiRoute: "initial" }));
  });
});
