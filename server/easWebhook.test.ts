import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyEasWebhookSignature } from "./easWebhook";

describe("EAS webhook signature verification", () => {
  it("accepts the Expo HMAC-SHA1 signature for the original raw body", () => {
    const secret = "this-is-a-valid-webhook-secret";
    const rawBody = Buffer.from('{"status":"finished"}', "utf8");
    const signature = `sha1=${createHmac("sha1", secret).update(rawBody).digest("hex")}`;

    expect(verifyEasWebhookSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyEasWebhookSignature(Buffer.from('{"status":"errored"}', "utf8"), signature, secret)).toBe(false);
  });

  it("rejects missing or short webhook secrets", () => {
    expect(verifyEasWebhookSignature(Buffer.from("{}"), "sha1=invalid", "too-short")).toBe(false);
    expect(verifyEasWebhookSignature(Buffer.from("{}"), undefined, "this-is-a-valid-webhook-secret")).toBe(false);
  });
});
