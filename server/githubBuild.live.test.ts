import { describe, expect, it } from "vitest";
import { GITHUB_REPOSITORY, verifyGithubBuildToken, verifyGithubExpoTokenSecret } from "./githubBuild";

describe("GitHub build bridge live token validation", () => {
  it("authenticates the configured server-only credential against the Lakay repository", async () => {
    const result = await verifyGithubBuildToken();
    expect(result).toEqual({ ok: true, repository: GITHUB_REPOSITORY });
  }, 20_000);

  it("finds the required Expo Actions secret without reading its value", async () => {
    await expect(verifyGithubExpoTokenSecret()).resolves.toEqual({ ok: true });
  }, 20_000);
});
