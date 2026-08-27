import { createHmac, timingSafeEqual } from "node:crypto";
import express, { type Express, type Request, type Response } from "express";
import { z } from "zod";
import * as db from "./db";
import { transitionOwnedRunnerJob } from "./runnerJobs";

const webhookPayload = z.object({
  id: z.string().min(1).max(128),
  platform: z.literal("android"),
  status: z.enum(["finished", "errored", "canceled"]),
  artifacts: z.object({ buildUrl: z.string().url().optional() }).optional(),
  expirationDate: z.string().datetime().optional(),
  metadata: z.object({ message: z.string().max(256).optional() }).optional(),
});

function signatureFor(rawBody: Buffer, secret: string) {
  return `sha1=${createHmac("sha1", secret).update(rawBody).digest("hex")}`;
}

export function verifyEasWebhookSignature(rawBody: Buffer, signature: string | undefined, secret = process.env.EAS_WEBHOOK_SECRET) {
  if (!secret || secret.length < 16 || !signature) return false;
  const expected = signatureFor(rawBody, secret);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function getJobId(message: string | undefined) {
  return /^Lakay job ([A-Za-z0-9_-]{6,64})$/.exec(message ?? "")?.[1];
}

function safeAndroidDelivery(buildUrl: string | undefined, expirationDate: string | undefined) {
  if (!buildUrl || !expirationDate) return undefined;
  try {
    const parsed = new URL(buildUrl);
    if (parsed.protocol !== "https:" || new Date(expirationDate).getTime() <= Date.now()) return undefined;
    return { downloadUrl: buildUrl, filename: parsed.pathname.endsWith(".aab") ? "application.aab" : "application.apk", expiresAt: expirationDate };
  } catch {
    return undefined;
  }
}

async function receiveEasWebhook(req: Request, res: Response) {
  const secret = process.env.EAS_WEBHOOK_SECRET;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  const signature = typeof req.headers["expo-signature"] === "string" ? req.headers["expo-signature"] : undefined;
  if (!secret || secret.length < 16) return res.status(503).send("Webhook configuration unavailable.");
  if (!verifyEasWebhookSignature(rawBody, signature, secret)) return res.status(401).send("Invalid webhook signature.");
  let body: unknown;
  try {
    body = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid webhook payload.");
  }
  const parsed = webhookPayload.safeParse(body);
  if (!parsed.success) return res.status(400).send("Invalid webhook payload.");
  const jobId = getJobId(parsed.data.metadata?.message);
  if (!jobId) return res.status(202).send("Ignored.");
  const job = await db.getRunnerJobById(jobId);
  if (!job || job.state === "expired" || job.state === "cancelled") return res.status(202).send("Ignored.");

  const artifact = {
    ...job.artifact,
    easBuild: { buildId: parsed.data.id, platform: "android" as const, status: parsed.data.status },
  };
  if (parsed.data.status === "finished") {
    const delivery = safeAndroidDelivery(parsed.data.artifacts?.buildUrl, parsed.data.expirationDate);
    if (!delivery) return res.status(202).send("Build completed without a verified delivery link.");
    await db.updateRunnerJobArtifactForUser({ userId: job.userId, projectId: job.projectId, jobId, artifact: { ...artifact, delivery: { ...artifact.delivery, apk: delivery } } });
    if (job.state === "building") await transitionOwnedRunnerJob({ userId: job.userId, projectId: job.projectId, jobId, nextState: "testing", message: "La génération Android a été terminée et sa livraison est en cours de vérification." });
    const current = await db.getRunnerJobForUser(job.userId, job.projectId, jobId);
    if (current?.state === "testing") await transitionOwnedRunnerJob({ userId: job.userId, projectId: job.projectId, jobId, nextState: "preview_ready", message: "Le téléchargement Android vérifié est prêt." });
  } else {
    await db.updateRunnerJobArtifactForUser({ userId: job.userId, projectId: job.projectId, jobId, artifact });
    if (["runner_assigned", "installing", "building", "testing"].includes(job.state)) await transitionOwnedRunnerJob({ userId: job.userId, projectId: job.projectId, jobId, nextState: "failed", message: "La génération Android n’a pas abouti. Consultez le statut de publication et réessayez après correction." });
  }
  return res.status(200).send("OK");
}

export function registerEasWebhook(app: Express) {
  app.get("/api/eas/webhook", (_req, res) => res.status(200).json({ service: "Lakay Android build webhook", accepts: "signed Expo BUILD POST events" }));
  app.post("/api/eas/webhook", express.raw({ type: "*/*" }), receiveEasWebhook);
}
