import { createHmac, timingSafeEqual } from "node:crypto";

export type RunnerHandoffClaim = { projectId: string; userId: number; expiresAt: string; nonce: string };

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signRunnerHandoffClaim(claim: RunnerHandoffClaim, secret = process.env.JWT_SECRET): string {
  if (!secret) throw new Error("Runner handoff signing secret is unavailable.");
  const payload = encode(claim);
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyRunnerHandoffClaim(token: string, secret = process.env.JWT_SECRET): RunnerHandoffClaim | undefined {
  if (!secret) return undefined;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as RunnerHandoffClaim;
    if (!claim.projectId || !Number.isInteger(claim.userId) || !claim.expiresAt || new Date(claim.expiresAt).getTime() <= Date.now()) return undefined;
    return claim;
  } catch {
    return undefined;
  }
}
