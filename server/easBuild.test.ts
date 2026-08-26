import { describe, expect, it, vi } from "vitest";
import { EAS_GRAPHQL_URL, getEasBuildReadiness, verifyEasBuildToken } from "./easBuild";

describe("EAS Build token probe", () => {
  it("calls Expo's lightweight viewer endpoint with the server-only bearer token", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { me: { username: "lakay" } } }) });
    vi.stubGlobal("fetch", request);
    await expect(verifyEasBuildToken("server-token")).resolves.toEqual({ ok: true, account: "lakay" });
    expect(request).toHaveBeenCalledWith(EAS_GRAPHQL_URL, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer server-token" }) }));
  });

  it("reports sanitized EAS readiness while retaining GitHub Actions as the supported submission mode", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { me: { username: "zetwal" } } }) });
    vi.stubGlobal("fetch", request);
    await expect(getEasBuildReadiness("server-token", "0123456789abcdef")).resolves.toEqual({ tokenConfigured: true, tokenVerified: true, account: "zetwal", webhookSecretConfigured: true, submissionMode: "github_actions_ci" });
  });
});
