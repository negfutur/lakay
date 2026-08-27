import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const auth = readFileSync(resolve(process.cwd(), "server/googleAuth.ts"), "utf8");
const index = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");
const client = readFileSync(resolve(process.cwd(), "client/src/const.ts"), "utf8");
const gate = readFileSync(resolve(process.cwd(), "client/src/components/LocalAuthGate.tsx"), "utf8");

describe("Google OAuth sign-in guard", () => {
  it("stores one verified Google subject per Lakay user and retains the existing user identity", () => {
    expect(schema).toContain("externalAuthIdentities");
    expect(schema).toContain('uniqueIndex("external_auth_provider_subject_unique")');
    expect(schema).toContain("references(() => users.id");
    expect(database).toContain("resolveGoogleIdentity");
    expect(database).toContain('eq(externalAuthIdentities.provider, "google")');
    expect(database).toContain('eq(users.email, email)');
    expect(database).toContain('loginMethod: "google"');
  });

  it("uses a state nonce, an exact callback origin, a confidential code exchange, and verified Google ID tokens", () => {
    expect(auth).toContain("GOOGLE_STATE_COOKIE");
    expect(auth).toContain("randomBytes(32)");
    expect(auth).toContain("timingSafeEqual");
    expect(auth).toContain("GOOGLE_OAUTH_APP_ORIGIN");
    expect(auth).toContain("returnPath");
    expect(auth).toContain("jwtVerify(body.id_token, GOOGLE_JWKS");
    expect(auth).toContain("email_verified !== true");
    expect(auth).toContain("client_secret: ENV.googleOAuthClientSecret");
    expect(auth).not.toContain("VITE_GOOGLE");
    expect(index).toContain("registerGoogleAuthRoutes(app)");
  });

  it("keeps the browser action free of credentials and preserves Manus as a separate sign-in method", () => {
    expect(client).toContain("startGoogleLogin");
    expect(client).toContain("GOOGLE_OAUTH_APP_ORIGIN");
    expect(client).toContain("returnPath=%2Fdashboard");
    expect(client).not.toContain("GOOGLE_OAUTH_CLIENT_SECRET");
    expect(gate).toContain("Continuer avec Google");
    expect(gate).toContain("Continuer avec Manus");
  });

  it("uses Lakay’s one registered production callback even when sign-in starts from a preview URL", () => {
    expect(auth).toContain('redirect_uri: `${GOOGLE_OAUTH_APP_ORIGIN}${CALLBACK_PATH}`');
    expect(auth).toContain('exchangeCodeForIdentity(code, `${GOOGLE_OAUTH_APP_ORIGIN}${CALLBACK_PATH}`)');
    expect(auth).not.toContain("safeOrigin");
    expect(client).toContain('`${GOOGLE_OAUTH_APP_ORIGIN}/api/auth/google/start?returnPath=%2Fdashboard`');
  });
});
