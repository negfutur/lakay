import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

const passwordSchema = z.string().min(10, "Le mot de passe doit contenir au moins 10 caractères.").max(128);
const emailSchema = z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(320);
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [algorithm, encodedSalt, encodedHash] = storedHash.split("$");
  if (algorithm !== "scrypt" || !encodedSalt || !encodedHash) return false;
  const actual = scryptSync(password, Buffer.from(encodedSalt, "base64url"), 64);
  const expected = Buffer.from(encodedHash, "base64url");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function issueSession(ctx: { req: any; res: any }, openId: string, name: string) {
  const sessionToken = await sdk.createSessionToken(openId, { name: name || "Utilisateur Lakay", expiresInMs: ONE_YEAR_MS });
  ctx.res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(ctx.req), maxAge: ONE_YEAR_MS });
}

export const localAuthRouter = router({
  register: publicProcedure.input(z.object({ email: emailSchema, password: passwordSchema, name: z.string().trim().min(1).max(120).optional() })).mutation(async ({ ctx, input }) => {
    const existing = await db.getLocalAuthAccountByEmail(input.email);
    if (existing) throw new TRPCError({ code: "CONFLICT", message: "Un compte utilise déjà cette adresse e-mail." });
    const openId = `local_${nanoid(24)}`;
    const name = input.name || input.email.split("@")[0] || "Utilisateur Lakay";
    try {
      await db.createLocalAuthAccount({ openId, email: input.email, name, passwordHash: hashPassword(input.password) });
    } catch (error) {
      console.error("[Local Auth] Registration failed", error instanceof Error ? error.message : error);
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Votre compte n’a pas pu être créé pour le moment. Réessayez dans un instant." });
    }
    await issueSession(ctx, openId, name);
    return { success: true } as const;
  }),
  login: publicProcedure.input(z.object({ email: emailSchema, password: z.string().min(1).max(128) })).mutation(async ({ ctx, input }) => {
    const record = await db.getLocalAuthAccountByEmail(input.email);
    const genericError = new TRPCError({ code: "UNAUTHORIZED", message: "Adresse e-mail ou mot de passe incorrect." });
    if (!record) throw genericError;
    const { account, user } = record;
    if (account.lockedUntil && account.lockedUntil.getTime() > Date.now()) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop de tentatives. Réessayez dans quelques minutes." });
    }
    if (!verifyPassword(input.password, account.passwordHash)) {
      const nextAttempts = account.failedAttempts + 1;
      await db.recordLocalAuthFailure(account.id, nextAttempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null);
      throw genericError;
    }
    await db.recordLocalAuthSuccess(account.id, user.openId);
    await issueSession(ctx, user.openId, user.name || input.email.split("@")[0] || "Utilisateur Lakay");
    return { success: true } as const;
  }),
  recoveryReadiness: publicProcedure.query(() => ({ deliveryConfigured: false, provider: null as string | null })),
  requestPasswordRecovery: publicProcedure.input(z.object({ email: emailSchema })).mutation(async () => {
    // Keep the response uniform: no account enumeration and no token is issued until a mail provider can deliver it safely.
    return { accepted: true, deliveryConfigured: false } as const;
  }),
  resetPassword: publicProcedure.input(z.object({ token: z.string().min(20).max(512), password: passwordSchema })).mutation(async ({ input }) => {
    const changed = await db.resetLocalPasswordFromRecoveryToken(input.token, hashPassword(input.password));
    if (!changed) throw new TRPCError({ code: "BAD_REQUEST", message: "Ce lien de récupération est expiré ou a déjà été utilisé." });
    return { success: true } as const;
  }),
  credentialStatus: protectedProcedure.query(async ({ ctx }) => ({ configured: Boolean(await db.getLocalAuthAccountForUser(ctx.user.id)), email: ctx.user.email || null })),
  setPasswordForCurrentUser: protectedProcedure.input(z.object({ password: passwordSchema })).mutation(async ({ ctx, input }) => {
    const email = ctx.user.email?.trim().toLowerCase();
    if (!email) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ajoutez une adresse e-mail vérifiée à votre compte avant de créer un mot de passe Lakay." });
    const saved = await db.setLocalAuthPasswordForUser({ userId: ctx.user.id, email, passwordHash: hashPassword(input.password) });
    if (!saved) throw new TRPCError({ code: "CONFLICT", message: "Cette adresse e-mail est déjà liée à un autre compte Lakay." });
    return { success: true } as const;
  }),
});
