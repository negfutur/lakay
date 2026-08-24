import { and, asc, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import type { ProjectPlan } from "../shared/project";
import { creditBalances, creditLedger, InsertUser, projectBuildVersions, projectFiles, projectMessages, projectPreviewShares, projectRunnerJobLogs, projectRunnerJobs, projectRunnerProfiles, projects, users } from "../drizzle/schema";
import type { BuilderFile, BuilderFilePath, BuilderVersion } from "../shared/builder";
import type { FullStackRunnerManifest, RunnerExecutionMode, RunnerProfileStatus, RunnerStatusEvent } from "../shared/runner";
import type { RunnerArtifact, RunnerJobState, RunnerLogLevel } from "../shared/runnerJobs";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await requireDb();
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  (["name", "email", "loginMethod"] as const).forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listProjectsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .limit(1);
  return result[0];
}

export async function createProject({
  userId,
  description,
  plan,
}: {
  userId: number;
  description: string;
  plan: ProjectPlan;
}) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projects).values({
    id,
    userId,
    name: plan.name,
    description,
    status: "ready",
    generatedPlan: plan,
  });
  return getProjectForUser(userId, id);
}

export async function updateProjectForUser(
  userId: number,
  projectId: string,
  changes: { name?: string; description?: string }
) {
  const db = await requireDb();
  await db.update(projects).set(changes).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return getProjectForUser(userId, projectId);
}

export async function deleteProjectForUser(userId: number, projectId: string): Promise<boolean> {
  const db = await requireDb();
  const existing = await getProjectForUser(userId, projectId);
  if (!existing) return false;
  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  return true;
}

export async function listProjectMessagesForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db
    .select({
      id: projectMessages.id,
      projectId: projectMessages.projectId,
      userId: projectMessages.userId,
      role: projectMessages.role,
      content: projectMessages.content,
      createdAt: projectMessages.createdAt,
    })
    .from(projectMessages)
    .innerJoin(projects, eq(projectMessages.projectId, projects.id))
    .where(and(eq(projectMessages.projectId, projectId), eq(projects.userId, userId)))
    .orderBy(asc(projectMessages.createdAt));
}

export async function createProjectMessage({
  projectId,
  userId,
  role,
  content,
}: {
  projectId: string;
  userId: number;
  role: "user" | "assistant";
  content: string;
}) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projectMessages).values({ id, projectId, userId, role, content });
  return { id };
}

export async function listBuilderFilesForUser(userId: number, projectId: string): Promise<BuilderFile[]> {
  const db = await requireDb();
  const files = await db
    .select({ path: projectFiles.path, language: projectFiles.language, content: projectFiles.content })
    .from(projectFiles)
    .where(and(eq(projectFiles.userId, userId), eq(projectFiles.projectId, projectId)))
    .orderBy(asc(projectFiles.path));
  return files as BuilderFile[];
}

function hashPreviewShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPreviewShareForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const files = await listBuilderFilesForUser(userId, projectId);
  if (!files.length) return undefined;
  const token = nanoid(48);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.update(projectPreviewShares).set({ revokedAt: new Date() }).where(and(eq(projectPreviewShares.userId, userId), eq(projectPreviewShares.projectId, projectId), isNull(projectPreviewShares.revokedAt)));
  await db.insert(projectPreviewShares).values({ id: nanoid(), projectId, userId, tokenHash: hashPreviewShareToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getSharedPreviewFiles(token: string): Promise<BuilderFile[] | undefined> {
  const db = await requireDb();
  const rows = await db.select().from(projectPreviewShares).where(and(eq(projectPreviewShares.tokenHash, hashPreviewShareToken(token)), isNull(projectPreviewShares.revokedAt), gte(projectPreviewShares.expiresAt, new Date()))).limit(1);
  const share = rows[0];
  if (!share) return undefined;
  return listBuilderFilesForUser(share.userId, share.projectId);
}

export async function listBuilderVersionsForUser(userId: number, projectId: string): Promise<BuilderVersion[]> {
  const db = await requireDb();
  const versions = await db
    .select()
    .from(projectBuildVersions)
    .where(and(eq(projectBuildVersions.userId, userId), eq(projectBuildVersions.projectId, projectId)))
    .orderBy(desc(projectBuildVersions.createdAt));
  return versions as BuilderVersion[];
}

export async function getRunnerProfileForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const result = await db.select().from(projectRunnerProfiles).where(and(eq(projectRunnerProfiles.userId, userId), eq(projectRunnerProfiles.projectId, projectId))).limit(1);
  return result[0];
}

export async function upsertRunnerProfileForUser({
  userId,
  projectId,
  mode,
  status,
  manifest,
  diagnostics,
  events,
}: {
  userId: number;
  projectId: string;
  mode: RunnerExecutionMode;
  status: RunnerProfileStatus;
  manifest: FullStackRunnerManifest | null;
  diagnostics: string[] | null;
  events: RunnerStatusEvent[] | null;
}) {
  const db = await requireDb();
  const project = await getProjectForUser(userId, projectId);
  if (!project) return undefined;
  await db.insert(projectRunnerProfiles).values({ userId, projectId, mode, status, manifest, diagnostics, events }).onDuplicateKeyUpdate({ set: { mode, status, manifest, diagnostics, events } });
  return getRunnerProfileForUser(userId, projectId);
}

export async function createRunnerJobForUser({
  userId,
  projectId,
  artifact,
  handoffToken,
  expiresAt,
}: {
  userId: number;
  projectId: string;
  artifact: RunnerArtifact;
  handoffToken: string;
  expiresAt: Date;
}) {
  const db = await requireDb();
  const project = await getProjectForUser(userId, projectId);
  if (!project) return undefined;
  const id = nanoid();
  const handoffTokenHash = createHash("sha256").update(handoffToken).digest("hex");
  await db.insert(projectRunnerJobs).values({ id, userId, projectId, state: "queued", artifact, handoffTokenHash, expiresAt });
  return getRunnerJobForUser(userId, projectId, id);
}

export async function getRunnerJobForUser(userId: number, projectId: string, jobId: string) {
  const db = await requireDb();
  const result = await db.select().from(projectRunnerJobs).where(and(eq(projectRunnerJobs.id, jobId), eq(projectRunnerJobs.projectId, projectId), eq(projectRunnerJobs.userId, userId))).limit(1);
  return result[0];
}

export async function listRunnerJobsForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db.select({ id: projectRunnerJobs.id, projectId: projectRunnerJobs.projectId, userId: projectRunnerJobs.userId, state: projectRunnerJobs.state, expiresAt: projectRunnerJobs.expiresAt, createdAt: projectRunnerJobs.createdAt, updatedAt: projectRunnerJobs.updatedAt })
    .from(projectRunnerJobs)
    .where(and(eq(projectRunnerJobs.userId, userId), eq(projectRunnerJobs.projectId, projectId)))
    .orderBy(desc(projectRunnerJobs.createdAt));
}

export async function createRunnerJobLogForUser({ jobId, userId, level, message }: { jobId: string; userId: number; level: RunnerLogLevel; message: string }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projectRunnerJobLogs).values({ id, jobId, userId, level, message });
  return { id };
}

export async function listRunnerJobLogsForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db.select({ id: projectRunnerJobLogs.id, jobId: projectRunnerJobLogs.jobId, level: projectRunnerJobLogs.level, message: projectRunnerJobLogs.message, createdAt: projectRunnerJobLogs.createdAt })
    .from(projectRunnerJobLogs)
    .innerJoin(projectRunnerJobs, eq(projectRunnerJobLogs.jobId, projectRunnerJobs.id))
    .where(and(eq(projectRunnerJobLogs.userId, userId), eq(projectRunnerJobs.userId, userId), eq(projectRunnerJobs.projectId, projectId)))
    .orderBy(desc(projectRunnerJobLogs.createdAt));
}

export async function transitionRunnerJobForUser({ userId, projectId, jobId, fromState, state }: { userId: number; projectId: string; jobId: string; fromState: RunnerJobState; state: RunnerJobState }) {
  const db = await requireDb();
  await db.update(projectRunnerJobs).set({ state }).where(and(eq(projectRunnerJobs.id, jobId), eq(projectRunnerJobs.projectId, projectId), eq(projectRunnerJobs.userId, userId), eq(projectRunnerJobs.state, fromState)));
  const updated = await getRunnerJobForUser(userId, projectId, jobId);
  return updated?.state === state ? updated : undefined;
}

export async function getBuilderVersionForUser(userId: number, projectId: string, versionId: string): Promise<BuilderVersion | undefined> {
  const db = await requireDb();
  const result = await db
    .select()
    .from(projectBuildVersions)
    .where(and(eq(projectBuildVersions.id, versionId), eq(projectBuildVersions.userId, userId), eq(projectBuildVersions.projectId, projectId)))
    .limit(1);
  return result[0] as BuilderVersion | undefined;
}

export async function replaceBuilderFilesForUser({
  userId,
  projectId,
  files,
  instruction,
  summary,
  origin,
}: {
  userId: number;
  projectId: string;
  files: BuilderFile[];
  instruction: string | null;
  summary: string | null;
  origin: "generate" | "restore" | "edit";
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const project = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);
    if (!project[0]) return undefined;
    await tx.delete(projectFiles).where(and(eq(projectFiles.userId, userId), eq(projectFiles.projectId, projectId)));
    await tx.insert(projectFiles).values(files.map(file => ({
      id: nanoid(), projectId, userId, path: file.path, language: file.language, content: file.content,
    })));
    const versionId = nanoid();
    await tx.insert(projectBuildVersions).values({ id: versionId, projectId, userId, instruction, summary, origin, files });
    return { versionId, files };
  });
}

export async function updateBuilderFileAndSnapshotForUser(userId: number, projectId: string, path: BuilderFilePath, content: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const files = await tx
      .select({ id: projectFiles.id, path: projectFiles.path, language: projectFiles.language, content: projectFiles.content })
      .from(projectFiles)
      .where(and(eq(projectFiles.userId, userId), eq(projectFiles.projectId, projectId)));
    const existing = files.find(file => file.path === path);
    if (!existing) return undefined;
    await tx.update(projectFiles).set({ content }).where(eq(projectFiles.id, existing.id));
    const snapshot = files.map(file => ({
      path: file.path as BuilderFilePath,
      language: file.language as BuilderFile["language"],
      content: file.path === path ? content : file.content,
    }));
    const versionId = nanoid();
    await tx.insert(projectBuildVersions).values({
      id: versionId,
      projectId,
      userId,
      instruction: `Edited ${path}`,
      summary: `Manual update to ${path}.`,
      origin: "edit",
      files: snapshot,
    });
    return { path, content, versionId };
  });
}

export async function getCreditBalanceForUser(userId: number) {
  const db = await requireDb();
  await db.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
  const result = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  return result[0] ?? { userId, balance: 0, updatedAt: new Date() };
}

export async function listCreditLedgerForUser(userId: number) {
  const db = await requireDb();
  return db.select({ id: creditLedger.id, kind: creditLedger.kind, amount: creditLedger.amount, balanceAfter: creditLedger.balanceAfter, operation: creditLedger.operation, stripeCheckoutSessionId: creditLedger.stripeCheckoutSessionId, createdAt: creditLedger.createdAt }).from(creditLedger).where(eq(creditLedger.userId, userId)).orderBy(desc(creditLedger.createdAt));
}

export async function creditCheckoutForUser({ userId, credits, stripeCheckoutSessionId, stripePaymentIntentId, stripeEventId }: { userId: number; credits: number; stripeCheckoutSessionId: string; stripePaymentIntentId: string | null; stripeEventId: string }) {
  const db = await requireDb();
  try {
    return await db.transaction(async tx => {
      const alreadyProcessed = await tx.select({ id: creditLedger.id }).from(creditLedger).where(eq(creditLedger.sourceEventId, stripeEventId)).limit(1);
      if (alreadyProcessed[0]) return { credited: false, duplicate: true };
      await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
      await tx.update(creditBalances).set({ balance: sql`${creditBalances.balance} + ${credits}` }).where(eq(creditBalances.userId, userId));
      const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
      const balanceAfter = balance[0]?.balance;
      if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after checkout.");
      await tx.insert(creditLedger).values({ id: nanoid(), userId, kind: "purchase", amount: credits, balanceAfter, stripeCheckoutSessionId, stripePaymentIntentId, sourceEventId: stripeEventId });
      return { credited: true, duplicate: false, balanceAfter };
    });
  } catch (error) {
    const existing = await db.select({ id: creditLedger.id, balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.sourceEventId, stripeEventId)).limit(1);
    if (existing[0]) return { credited: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
    const existingCheckout = await db.select({ id: creditLedger.id, balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.stripeCheckoutSessionId, stripeCheckoutSessionId)).limit(1);
    if (existingCheckout[0]) return { credited: false, duplicate: true, balanceAfter: existingCheckout[0].balanceAfter };
    throw error;
  }
}

export async function consumeCreditForUser({ userId, credits, operation, idempotencyKey }: { userId: number; credits: number; operation: string; idempotencyKey: string }) {
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("Credit consumption must be a positive whole number.");
  const db = await requireDb();
  try {
    return await db.transaction(async tx => {
      const existing = await tx.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
      if (existing[0]) return { consumed: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
      await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
      const result = await tx.update(creditBalances).set({ balance: sql`${creditBalances.balance} - ${credits}` }).where(and(eq(creditBalances.userId, userId), gte(creditBalances.balance, credits)));
      const affectedRows = Number((result as unknown as { affectedRows?: number })?.affectedRows ?? 0);
      if (affectedRows !== 1) return { consumed: false, insufficient: true };
      const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
      const balanceAfter = balance[0]?.balance;
      if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after usage.");
      await tx.insert(creditLedger).values({ id: nanoid(), userId, kind: "usage", amount: -credits, balanceAfter, operation, idempotencyKey });
      return { consumed: true, duplicate: false, balanceAfter };
    });
  } catch (error) {
    const existing = await db.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) return { consumed: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
    throw error;
  }
}

export async function refundCreditForUser({ userId, credits, operation, idempotencyKey }: { userId: number; credits: number; operation: string; idempotencyKey: string }) {
  if (!Number.isInteger(credits) || credits <= 0) throw new Error("Credit refund must be a positive whole number.");
  const db = await requireDb();
  const refundKey = `refund:${idempotencyKey}`;
  return db.transaction(async tx => {
    const existingRefund = await tx.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, refundKey)).limit(1);
    if (existingRefund[0]) return { refunded: false, duplicate: true, balanceAfter: existingRefund[0].balanceAfter };
    await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
    await tx.update(creditBalances).set({ balance: sql`${creditBalances.balance} + ${credits}` }).where(eq(creditBalances.userId, userId));
    const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
    const balanceAfter = balance[0]?.balance;
    if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after refund.");
    await tx.insert(creditLedger).values({ id: nanoid(), userId, kind: "adjustment", amount: credits, balanceAfter, operation: `provider_refund:${operation}`, idempotencyKey: refundKey });
    return { refunded: true, duplicate: false, balanceAfter };
  });
}
