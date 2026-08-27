import { describe, expect, it, vi } from "vitest";

vi.mock("./githubBuild", () => ({
  verifyGithubBuildToken: vi.fn(),
  verifyGithubExpoTokenSecret: vi.fn(),
}));

import { getAndroidBuildReadiness } from "./easBuild";
import { verifyGithubBuildToken, verifyGithubExpoTokenSecret } from "./githubBuild";

describe("Android EAS readiness", () => {
  it("requires verified Expo and GitHub prerequisites plus the signed webhook before a build is dispatchable", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { me: { username: "zetwal" } } }) });
    vi.stubGlobal("fetch", request);
    vi.stubEnv("EAS_BUILD_TOKEN", "server-only-token");
    vi.stubEnv("EAS_WEBHOOK_SECRET", "webhook-secret-with-16-chars");
    vi.mocked(verifyGithubBuildToken).mockResolvedValue({ ok: true, repository: "negfutur/lakay" });
    vi.mocked(verifyGithubExpoTokenSecret).mockResolvedValue({ ok: true });

    await expect(getAndroidBuildReadiness()).resolves.toEqual({ ready: true, expoToken: "verified", githubBridge: "verified", githubExpoSecret: "verified", webhook: "configured" });
  });
});
