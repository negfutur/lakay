import type { RunnerArtifact } from "../shared/runnerJobs";

export const GITHUB_REPOSITORY = "negfutur/lakay";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const GITHUB_API_VERSION = "2022-11-28";
const MOBILE_SOURCE_PATHS = ["mobile/package.json", "mobile/app.json", "mobile/eas.json", "mobile/App.tsx"] as const;

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

async function githubRequest(path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { ...githubHeaders(token), ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    throw new Error(`GitHub build bridge request failed (${response.status}): ${responseText.slice(0, 240) || "unknown error"}`);
  }
  return response;
}

export async function verifyGithubBuildToken(token = process.env.GITHUB_BUILD_TOKEN): Promise<{ ok: boolean; repository?: string }> {
  if (!token) return { ok: false };
  const response = await fetch(GITHUB_API_URL, { headers: githubHeaders(token) });
  if (!response.ok) return { ok: false };
  const body = await response.json() as { full_name?: string };
  if (body.full_name !== GITHUB_REPOSITORY) return { ok: false };
  const workflowResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/eas-build.yml`, { headers: githubHeaders(token) });
  return workflowResponse.ok ? { ok: true, repository: body.full_name } : { ok: false };
}

export async function verifyGithubExpoTokenSecret(token = process.env.GITHUB_BUILD_TOKEN): Promise<{ ok: boolean }> {
  if (!token) return { ok: false };
  const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/secrets/EXPO_TOKEN`, { headers: githubHeaders(token) });
  return { ok: response.ok };
}

export async function uploadMobileSourceAndDispatchGithubEasBuild({
  jobId,
  artifact,
  buildProfile,
  token = process.env.GITHUB_BUILD_TOKEN,
}: {
  jobId: string;
  artifact: RunnerArtifact;
  buildProfile: "preview" | "production";
  token?: string;
}): Promise<{ repository: string; branch: string; workflow: string; dispatchedAt: string }> {
  if (!token) throw new Error("GitHub build bridge is not configured.");
  const mobileFiles = MOBILE_SOURCE_PATHS.map(path => artifact.files.find(file => file.path === path)).filter((file): file is { path: string; content: string } => Boolean(file));
  if (mobileFiles.length !== MOBILE_SOURCE_PATHS.length) throw new Error("The generated Expo package is incomplete.");

  const reference = await githubRequest(`/repos/${GITHUB_REPOSITORY}/git/ref/heads/main`, token);
  const referenceBody = await reference.json() as { object?: { sha?: string } };
  const parentSha = referenceBody.object?.sha;
  if (!parentSha) throw new Error("GitHub did not return the main branch reference.");

  const branch = `lakay/mobile-build-${jobId}`;
  await githubRequest(`/repos/${GITHUB_REPOSITORY}/git/refs`, token, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: parentSha }),
  });

  const mobileDirectory = `builds/${jobId}`;
  for (const file of mobileFiles) {
    const filename = file.path.slice("mobile/".length);
    await githubRequest(`/repos/${GITHUB_REPOSITORY}/contents/${mobileDirectory}/${filename}`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: `Lakay mobile build ${jobId}: ${filename}`,
        content: Buffer.from(file.content, "utf8").toString("base64"),
        branch,
      }),
    });
  }

  await githubRequest(`/repos/${GITHUB_REPOSITORY}/actions/workflows/eas-build.yml/dispatches`, token, {
    method: "POST",
    body: JSON.stringify({ ref: branch, inputs: { mobile_directory: mobileDirectory, build_profile: buildProfile, job_id: jobId } }),
  });
  return { repository: GITHUB_REPOSITORY, branch, workflow: "eas-build.yml", dispatchedAt: new Date().toISOString() };
}
