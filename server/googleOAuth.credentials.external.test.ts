import { describe, expect, it } from "vitest";

describe("Google OAuth server credential", () => {
  it("accepts the configured confidential client before user authorization is implemented", async () => {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(clientId, "GOOGLE_OAUTH_CLIENT_ID must be configured").toBeTruthy();
    expect(clientSecret, "GOOGLE_OAUTH_CLIENT_SECRET must be configured").toBeTruthy();

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId || "",
        client_secret: clientSecret || "",
        code: "lakay-credential-validation-no-user-code",
        grant_type: "authorization_code",
        redirect_uri: "https://lakayapp-hiqx5oba.manus.space/api/auth/google/callback",
      }),
    });
    const payload = await response.json() as { error?: string; error_description?: string };
    expect(payload.error_description || payload.error).not.toMatch(/invalid client|client authentication failed/i);
    expect(response.status).not.toBe(401);
  }, 15_000);
});
