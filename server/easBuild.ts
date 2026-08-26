export const EAS_GRAPHQL_URL = "https://api.expo.dev/graphql";

export async function verifyEasBuildToken(token = process.env.EAS_BUILD_TOKEN): Promise<{ ok: boolean; account?: string }> {
  if (!token) return { ok: false };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(EAS_GRAPHQL_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query LakayEasTokenProbe { me { username } }" }),
        signal: controller.signal,
      });
      if (!response.ok) return { ok: false };
      const body = await response.json() as { data?: { me?: { username?: string } } };
      return body.data?.me?.username ? { ok: true, account: body.data.me.username } : { ok: false };
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return { ok: false };
  }
}

export async function getEasBuildReadiness(token = process.env.EAS_BUILD_TOKEN, webhookSecret = process.env.EAS_WEBHOOK_SECRET) {
  const tokenStatus = await verifyEasBuildToken(token);
  return {
    tokenConfigured: Boolean(token),
    tokenVerified: tokenStatus.ok,
    account: tokenStatus.account,
    webhookSecretConfigured: Boolean(webhookSecret && webhookSecret.length >= 16),
    submissionMode: "github_actions_ci" as const,
  };
}
