import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./aiProviderCore", () => ({ invokeProviderFallback: vi.fn(), invokeProviderStreamFallback: vi.fn() }));

import { invokeProviderFallback } from "./aiProviderCore";
import { invokeLakayProvider } from "./aiProvider";

describe("Lakay provider-neutral routing", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a conversational capability through the Gemini follow-up route", async () => {
    vi.mocked(invokeProviderFallback).mockResolvedValue({ choices: [{ message: { content: "Bonjour." }, finish_reason: "stop" }] } as never);
    await invokeLakayProvider({ messages: [{ role: "user", content: "Bonjour" }] }, { task: "conversation" });
    expect(invokeProviderFallback).toHaveBeenCalledWith(expect.objectContaining({ geminiRoute: "followup" }));
  });

  it("routes an initial build through the Gemini Pro route without exposing a provider to the Builder", async () => {
    vi.mocked(invokeProviderFallback).mockResolvedValue({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] } as never);
    await invokeLakayProvider({ messages: [{ role: "user", content: "Construis une V1" }] }, { task: "build_initial" });
    expect(invokeProviderFallback).toHaveBeenCalledWith(expect.objectContaining({ geminiRoute: "pro" }));
  });

  it("refuses an unconfigured specialized capability instead of pretending a provider was selected", async () => {
    await expect(invokeLakayProvider({ messages: [{ role: "user", content: "Génère une image" }] }, { task: "image_generation", requiredCapabilities: ["image_generation"] })).rejects.toThrow("n’est pas configurée");
    expect(invokeProviderFallback).not.toHaveBeenCalled();
  });
});
