export const EAS_GRAPHQL_URL = "https://api.expo.dev/graphql";

export async function verifyEasBuildToken(token = process.env.EAS_BUILD_TOKEN): Promise<{ ok: boolean; account?: string }> {
  if (!token) return { ok: false };
  const response = await fetch(EAS_GRAPHQL_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "query LakayEasTokenProbe { me { username } }" }),
  });
  if (!response.ok) return { ok: false };
  const body = await response.json() as { data?: { me?: { username?: string } } };
  return body.data?.me?.username ? { ok: true, account: body.data.me.username } : { ok: false };
}
