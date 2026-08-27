import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import * as db from "./db";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_STATE_COOKIE = "lakay_google_oauth_state";
const CALLBACK_PATH = "/api/auth/google/callback";
const STATE_TTL_MS = 10 * 60 * 1000;

function configured() {
  return Boolean(ENV.googleOAuthClientId && ENV.googleOAuthClientSecret);
}

function readQuery(req: Request, key: string) {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function decodeState(state: string): { nonce: string; origin: string } | undefined {
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { nonce?: unknown; origin?: unknown };
    return typeof decoded.nonce === "string" && typeof decoded.origin === "string" ? { nonce: decoded.nonce, origin: decoded.origin } : undefined;
  } catch {
    return undefined;
  }
}

function safeOrigin(rawOrigin: string | undefined) {
  if (!rawOrigin) return undefined;
  try {
    const url = new URL(rawOrigin);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((url.protocol !== "https:" && !local) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function stateCookieOptions(req: Request) {
  const session = getSessionCookieOptions(req);
  return { httpOnly: true, path: "/", sameSite: "lax" as const, secure: session.secure, maxAge: STATE_TTL_MS };
}

function stateMatches(actual: string | undefined, expected: string | undefined) {
  if (!actual || !expected) return false;
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

async function exchangeCodeForIdentity(code: string, redirectUri: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: ENV.googleOAuthClientId, client_secret: ENV.googleOAuthClientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  const body = await response.json() as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok || !body.id_token) throw new Error(body.error_description || body.error || "Google n’a pas fourni une identité vérifiable.");
  const { payload } = await jwtVerify(body.id_token, GOOGLE_JWKS, { issuer: ["https://accounts.google.com", "accounts.google.com"], audience: ENV.googleOAuthClientId });
  const subject = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!subject || !email || payload.email_verified !== true) throw new Error("Google doit fournir une adresse e-mail vérifiée.");
  return { subject, email, name: typeof payload.name === "string" ? payload.name.slice(0, 120) : null };
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/start", (req: Request, res: Response) => {
    if (!configured()) {
      res.status(503).json({ error: "Google sign-in is not configured" });
      return;
    }
    const origin = safeOrigin(readQuery(req, "origin"));
    if (!origin) {
      res.status(400).json({ error: "A valid application origin is required" });
      return;
    }
    const nonce = randomBytes(32).toString("base64url");
    const state = Buffer.from(JSON.stringify({ nonce, origin })).toString("base64url");
    res.cookie(GOOGLE_STATE_COOKIE, nonce, stateCookieOptions(req));
    const authorization = new URL(GOOGLE_AUTHORIZATION_URL);
    authorization.search = new URLSearchParams({
      client_id: ENV.googleOAuthClientId,
      redirect_uri: `${origin}${CALLBACK_PATH}`,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();
    res.redirect(302, authorization.toString());
  });

  app.get(CALLBACK_PATH, async (req: Request, res: Response) => {
    const code = readQuery(req, "code");
    const state = readQuery(req, "state");
    const parsed = state ? decodeState(state) : undefined;
    const expected = parseCookieHeader(req.headers.cookie || "")[GOOGLE_STATE_COOKIE];
    const origin = safeOrigin(parsed?.origin);
    if (!code || !parsed || !origin || !stateMatches(parsed.nonce, expected)) {
      res.status(403).json({ error: "Invalid Google OAuth state" });
      return;
    }
    res.clearCookie(GOOGLE_STATE_COOKIE, stateCookieOptions(req));
    try {
      const identity = await exchangeCodeForIdentity(code, `${origin}${CALLBACK_PATH}`);
      const user = await db.resolveGoogleIdentity(identity);
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name || "Utilisateur Lakay", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/dashboard");
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error instanceof Error ? error.message : error);
      res.status(401).json({ error: "Google sign-in could not be completed" });
    }
  });
}
