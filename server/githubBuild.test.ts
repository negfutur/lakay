import { afterEach, describe, expect, it, vi } from "vitest";
import { GITHUB_REPOSITORY, uploadMobileSourceAndDispatchGithubEasBuild, verifyGithubBuildToken, verifyGithubExpoTokenSecret } from "./githubBuild";

describe("GitHub build bridge credential", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses a server-only bearer token to verify access to the configured repository", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ full_name: GITHUB_REPOSITORY }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ path: ".github/workflows/eas-build.yml" }), { status: 200 }));

    await expect(verifyGithubBuildToken("server-only-token")).resolves.toEqual({ ok: true, repository: GITHUB_REPOSITORY });
    expect(fetchMock).toHaveBeenCalledWith(`https://api.github.com/repos/${GITHUB_REPOSITORY}`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-token" }),
    }));
    expect(fetchMock).toHaveBeenCalledWith(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/eas-build.yml`, expect.any(Object));
  });

  it("does not make a request when a token is unavailable", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await expect(verifyGithubBuildToken("")).resolves.toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks the required Expo Actions secret by name without reading its value", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ name: "EXPO_TOKEN" }), { status: 200 }));

    await expect(verifyGithubExpoTokenSecret("server-only-token")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/EXPO_TOKEN`, expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer server-only-token" }),
    }));
  });

  it("uploads only the generated Expo target to an isolated branch and dispatches the Android workflow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ object: { sha: "main-sha" } }), { status: 200 }))
      .mockResolvedValue(new Response("{}", { status: 201 }));
    const artifact = {
      files: [
        { path: "mobile/package.json", content: "{}" },
        { path: "mobile/app.json", content: "{}" },
        { path: "mobile/eas.json", content: "{}" },
        { path: "mobile/App.tsx", content: "export default function App() { return null; }" },
        { path: "server/index.ts", content: "must not be uploaded" },
      ],
    } as never;

    const result = await uploadMobileSourceAndDispatchGithubEasBuild({ jobId: "job-123", artifact, buildProfile: "preview", token: "server-only-token" });

    expect(result).toMatchObject({ repository: GITHUB_REPOSITORY, branch: "lakay/mobile-build-job-123", workflow: "eas-build.yml" });
    expect(fetchMock).toHaveBeenCalledWith(`https://api.github.com/repos/${GITHUB_REPOSITORY}/git/ref/heads/main`, expect.any(Object));
    const serializedCalls = JSON.stringify(fetchMock.mock.calls);
    expect(serializedCalls).toContain("builds/job-123/package.json");
    expect(serializedCalls).toContain("actions/workflows/eas-build.yml/dispatches");
    expect(serializedCalls).not.toContain("server/index.ts");
    const dispatchOptions = fetchMock.mock.calls.at(-1)?.[1] as RequestInit;
    expect(JSON.parse(String(dispatchOptions.body))).toMatchObject({
      ref: "lakay/mobile-build-job-123",
      inputs: { mobile_directory: "builds/job-123", build_profile: "preview", job_id: "job-123" },
    });
  });
});
