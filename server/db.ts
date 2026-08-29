import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { createHash, randomBytes } from "node:crypto";
import type { ProjectPlan } from "../shared/project";
import { adminCreditPackageDrafts, aiGenerationUsage, creditBalances, creditLedger, externalAuthIdentities, InsertUser, localAuthAccounts, localPasswordRecoveryTokens, projectAgentActions, projectBackgroundTasks, projectBuildVersions, projectDomains, projectFiles, projectInitialVisualReferences, projectMessageSequences, projectMessages, projectMobileBranding, projectMobileBuildAuthorizations, projectPreviewShares, projectRunnerJobLogs, projectRunnerJobs, projectRunnerProfiles, projects, userAiRequestLocks, users } from "../drizzle/schema";
import type { BuilderFile, BuilderFilePath, BuilderVersion } from "../shared/builder";
import type { FullStackRunnerManifest, RunnerExecutionMode, RunnerProfileStatus, RunnerStatusEvent } from "../shared/runner";
import type { RunnerArtifact, RunnerJobState, RunnerLogLevel } from "../shared/runnerJobs";
import type { BackgroundTaskState } from "../shared/backgroundTasks";
import { ENV } from "./_core/env";

export type MobileBrandingAsset = { key: string; url: string; filename: string; width: number; height: number };
export type MobileBranding = { icon: MobileBrandingAsset | null; splash: MobileBrandingAsset | null };

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
  const existingUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
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
  if (!existingUser[0]) {
    const createdUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
    if (createdUser[0]) await grantWelcomeCreditsForUser(createdUser[0].id);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function resolveGoogleIdentity(input: { subject: string; email: string; name: string | null }) {
  const database = await requireDb();
  const email = input.email.trim().toLowerCase();
  let resolvedUser: typeof users.$inferSelect | undefined;
  let created = false;
  await database.transaction(async tx => {
    const existing = await tx.select({ user: users, identity: externalAuthIdentities }).from(externalAuthIdentities).innerJoin(users, eq(externalAuthIdentities.userId, users.id)).where(and(eq(externalAuthIdentities.provider, "google"), eq(externalAuthIdentities.providerSubject, input.subject))).for("update").limit(1);
    if (existing[0]) {
      await tx.update(externalAuthIdentities).set({ email, lastSignedIn: new Date() }).where(eq(externalAuthIdentities.id, existing[0].identity.id));
      await tx.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, existing[0].user.id));
      resolvedUser = { ...existing[0].user, lastSignedIn: new Date() };
      return;
    }
    const matchingUsers = await tx.select().from(users).where(eq(users.email, email)).limit(2);
    if (matchingUsers.length > 1) throw new Error("Cette adresse e-mail est déjà associée à plusieurs comptes Lakay. Connectez-vous à votre compte existant pour la lier en toute sécurité.");
    if (matchingUsers[0]) {
      resolvedUser = matchingUsers[0];
      await tx.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, matchingUsers[0].id));
    } else {
      const openId = `google_${nanoid(24)}`;
      await tx.insert(users).values({ openId, email, name: input.name, loginMethod: "google", lastSignedIn: new Date() });
      const createdUser = await tx.select().from(users).where(eq(users.openId, openId)).limit(1);
      if (!createdUser[0]) throw new Error("Impossible de créer le compte Google Lakay.");
      resolvedUser = createdUser[0];
      created = true;
    }
    await tx.insert(externalAuthIdentities).values({ id: nanoid(), userId: resolvedUser.id, provider: "google", providerSubject: input.subject, email });
  });
  if (!resolvedUser) throw new Error("Impossible de résoudre le compte Google Lakay.");
  if (created) await grantWelcomeCreditsForUser(resolvedUser.id);
  return resolvedUser;
}

export async function getLocalAuthAccountByEmail(email: string) {
  const db = await requireDb();
  const rows = await db.select({ account: localAuthAccounts, user: users }).from(localAuthAccounts).innerJoin(users, eq(localAuthAccounts.userId, users.id)).where(eq(localAuthAccounts.email, email)).limit(1);
  return rows[0];
}

export async function getLocalAuthAccountForUser(userId: number) {
  const db = await requireDb();
  const rows = await db.select().from(localAuthAccounts).where(eq(localAuthAccounts.userId, userId)).limit(1);
  return rows[0];
}

export async function setLocalAuthPasswordForUser(input: { userId: number; email: string; passwordHash: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [byUser, byEmail] = await Promise.all([
      tx.select().from(localAuthAccounts).where(eq(localAuthAccounts.userId, input.userId)).limit(1),
      tx.select().from(localAuthAccounts).where(eq(localAuthAccounts.email, input.email)).limit(1),
    ]);
    if (byEmail[0] && byEmail[0].userId !== input.userId) return false;
    if (byUser[0]) {
      await tx.update(localAuthAccounts).set({ email: input.email, passwordHash: input.passwordHash, failedAttempts: 0, lockedUntil: null, passwordUpdatedAt: new Date() }).where(eq(localAuthAccounts.id, byUser[0].id));
      return true;
    }
    await tx.insert(localAuthAccounts).values({ userId: input.userId, email: input.email, passwordHash: input.passwordHash });
    return true;
  });
}

export async function createLocalAuthAccount(input: { openId: string; email: string; name: string | null; passwordHash: string }) {
  const db = await requireDb();
  let createdUserId: number | undefined;
  await db.transaction(async tx => {
    await tx.insert(users).values({ openId: input.openId, email: input.email, name: input.name, loginMethod: "email_password", lastSignedIn: new Date() });
    const created = await tx.select({ id: users.id }).from(users).where(eq(users.openId, input.openId)).limit(1);
    if (!created[0]) throw new Error("Unable to create local user");
    await tx.insert(localAuthAccounts).values({ userId: created[0].id, email: input.email, passwordHash: input.passwordHash });
    createdUserId = created[0].id;
  });
  if (!createdUserId) throw new Error("Unable to create local user");
  await grantWelcomeCreditsForUser(createdUserId);
}

export async function recordLocalAuthFailure(id: number, lockedUntil: Date | null) {
  const db = await requireDb();
  await db.update(localAuthAccounts).set({ failedAttempts: sql`${localAuthAccounts.failedAttempts} + 1`, lockedUntil }).where(eq(localAuthAccounts.id, id));
}

export async function recordLocalAuthSuccess(id: number, openId: string) {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.update(localAuthAccounts).set({ failedAttempts: 0, lockedUntil: null }).where(eq(localAuthAccounts.id, id));
    await tx.update(users).set({ lastSignedIn: new Date() }).where(eq(users.openId, openId));
  });
}

const LOCAL_RECOVERY_TTL_MS = 30 * 60 * 1000;

export async function createLocalPasswordRecoveryToken(userId: number) {
  const db = await requireDb();
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + LOCAL_RECOVERY_TTL_MS);
  await db.transaction(async tx => {
    await tx.update(localPasswordRecoveryTokens).set({ usedAt: new Date() }).where(and(eq(localPasswordRecoveryTokens.userId, userId), isNull(localPasswordRecoveryTokens.usedAt)));
    await tx.insert(localPasswordRecoveryTokens).values({ id: nanoid(), userId, tokenHash, expiresAt });
  });
  return { rawToken, expiresAt };
}

export async function resetLocalPasswordFromRecoveryToken(token: string, passwordHash: string) {
  const db = await requireDb();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return db.transaction(async tx => {
    const rows = await tx.select({ token: localPasswordRecoveryTokens, account: localAuthAccounts }).from(localPasswordRecoveryTokens).innerJoin(localAuthAccounts, eq(localPasswordRecoveryTokens.userId, localAuthAccounts.userId)).where(and(eq(localPasswordRecoveryTokens.tokenHash, tokenHash), isNull(localPasswordRecoveryTokens.usedAt), gte(localPasswordRecoveryTokens.expiresAt, new Date()))).for("update").limit(1);
    const record = rows[0];
    if (!record) return false;
    await tx.update(localPasswordRecoveryTokens).set({ usedAt: new Date() }).where(eq(localPasswordRecoveryTokens.id, record.token.id));
    await tx.update(localAuthAccounts).set({ passwordHash, failedAttempts: 0, lockedUntil: null, passwordUpdatedAt: new Date() }).where(eq(localAuthAccounts.id, record.account.id));
    return true;
  });
}

export async function getAdminOverview() {
  const db = await requireDb();
  const [[userCount], [projectCount], [generationCount], [mobileJobCount], recentUsers, recentJobs] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(users),
    db.select({ value: sql<number>`count(*)` }).from(projects),
    db.select({ value: sql<number>`count(*)` }).from(aiGenerationUsage),
    db.select({ value: sql<number>`count(*)` }).from(projectRunnerJobs),
    db.select({ id: users.id, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.lastSignedIn)).limit(8),
    db.select({ id: projectRunnerJobs.id, state: projectRunnerJobs.state, projectId: projectRunnerJobs.projectId, createdAt: projectRunnerJobs.createdAt }).from(projectRunnerJobs).orderBy(desc(projectRunnerJobs.createdAt)).limit(8),
  ]);
  return {
    totals: { users: Number(userCount?.value || 0), projects: Number(projectCount?.value || 0), generations: Number(generationCount?.value || 0), mobileJobs: Number(mobileJobCount?.value || 0) },
    recentUsers,
    recentJobs,
  };
}

export async function listAdminCreditPackageDrafts() {
  const db = await requireDb();
  return db.select().from(adminCreditPackageDrafts).orderBy(desc(adminCreditPackageDrafts.updatedAt));
}

export async function saveAdminCreditPackageDraft({
  createdByUserId,
  label,
  credits,
  stripePriceId,
}: {
  createdByUserId: number;
  label: string;
  credits: number;
  stripePriceId?: string;
}) {
  const db = await requireDb();
  const price = stripePriceId?.trim() || null;
  const status = price ? "approved" : "draft" as const;
  const id = nanoid();
  await db.insert(adminCreditPackageDrafts).values({ id, label, credits, stripePriceId: price, status, createdByUserId });
  const rows = await db.select().from(adminCreditPackageDrafts).where(eq(adminCreditPackageDrafts.id, id)).limit(1);
  return rows[0];
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
  target,
  plan,
}: {
  userId: number;
  description: string;
  target: "web" | "mobile";
  plan: ProjectPlan;
}) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projects).values({
    id,
    userId,
    name: plan.name,
    description,
    target,
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
      sequence: projectMessages.sequence,
      projectId: projectMessages.projectId,
      userId: projectMessages.userId,
      role: projectMessages.role,
      content: projectMessages.content,
      createdAt: projectMessages.createdAt,
    })
    .from(projectMessages)
    .innerJoin(projects, eq(projectMessages.projectId, projects.id))
    .where(and(eq(projectMessages.projectId, projectId), eq(projects.userId, userId)))
    .orderBy(asc(projectMessages.sequence), asc(projectMessages.createdAt), asc(projectMessages.role), asc(projectMessages.id));
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
  return db.transaction(async tx => {
    await tx.insert(projectMessageSequences).values({ projectId }).onDuplicateKeyUpdate({ set: { projectId } });
    const counter = await tx.select({ nextSequence: projectMessageSequences.nextSequence }).from(projectMessageSequences).where(eq(projectMessageSequences.projectId, projectId)).for("update").limit(1);
    const sequence = (counter[0]?.nextSequence ?? 0) + 1;
    await tx.update(projectMessageSequences).set({ nextSequence: sequence }).where(eq(projectMessageSequences.projectId, projectId));
    await tx.insert(projectMessages).values({ id, projectId, userId, role, content, sequence });
    return { id, sequence };
  });
}

export async function createBackgroundTaskForUser(input: {
  userId: number;
  projectId: string;
  requestId: string;
  instruction: string;
  visualReferenceKey?: string;
  visualReferenceMimeType?: "image/jpeg" | "image/png" | "image/webp";
  retryOfTaskId?: string;
  creditsCharged: number;
  creditOperation?: string;
  creditIdempotencyKey?: string;
}) {
  const db = await requireDb();
  const project = await getProjectForUser(input.userId, input.projectId);
  if (!project) return undefined;
  const id = nanoid();
  await db.insert(projectBackgroundTasks).values({
    id,
    projectId: input.projectId,
    userId: input.userId,
    requestId: input.requestId,
    instruction: input.instruction,
    visualReferenceKey: input.visualReferenceKey ?? null,
    visualReferenceMimeType: input.visualReferenceMimeType ?? null,
    retryOfTaskId: input.retryOfTaskId ?? null,
    status: "queued",
    progress: "Tâche en file d’attente…",
    creditsCharged: input.creditsCharged,
    creditOperation: input.creditOperation ?? null,
    creditIdempotencyKey: input.creditIdempotencyKey ?? null,
  }).onDuplicateKeyUpdate({ set: { requestId: input.requestId } });
  return getBackgroundTaskForUser(input.userId, input.projectId, id);
}

export async function getBackgroundTaskForUser(userId: number, projectId: string, taskId: string) {
  const db = await requireDb();
  const rows = await db.select().from(projectBackgroundTasks).where(and(eq(projectBackgroundTasks.id, taskId), eq(projectBackgroundTasks.userId, userId), eq(projectBackgroundTasks.projectId, projectId))).limit(1);
  return rows[0];
}

export async function listBackgroundTasksForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db.select().from(projectBackgroundTasks).where(and(eq(projectBackgroundTasks.userId, userId), eq(projectBackgroundTasks.projectId, projectId))).orderBy(desc(projectBackgroundTasks.updatedAt));
}

export async function getActiveBackgroundTaskForUser(userId: number, projectId?: string) {
  const db = await requireDb();
  const filters = [
    eq(projectBackgroundTasks.userId, userId),
    inArray(projectBackgroundTasks.status, ["queued", "in_progress", "requires_action"]),
  ];
  if (projectId) filters.push(eq(projectBackgroundTasks.projectId, projectId));
  const rows = await db.select().from(projectBackgroundTasks).where(and(
    ...filters,
  )).orderBy(desc(projectBackgroundTasks.updatedAt)).limit(1);
  return rows[0];
}

export async function setBackgroundTaskScheduleForUser(input: { userId: number; projectId: string; taskId: string; scheduleCronTaskUid: string }) {
  const db = await requireDb();
  await db.update(projectBackgroundTasks).set({ scheduleCronTaskUid: input.scheduleCronTaskUid }).where(and(eq(projectBackgroundTasks.id, input.taskId), eq(projectBackgroundTasks.userId, input.userId), eq(projectBackgroundTasks.projectId, input.projectId), isNull(projectBackgroundTasks.scheduleCronTaskUid)));
  return getBackgroundTaskForUser(input.userId, input.projectId, input.taskId);
}

export async function getBackgroundTaskByScheduleTaskUid(scheduleCronTaskUid: string) {
  const db = await requireDb();
  const rows = await db.select().from(projectBackgroundTasks).where(eq(projectBackgroundTasks.scheduleCronTaskUid, scheduleCronTaskUid)).limit(1);
  return rows[0];
}

export async function acquireAiRequestLeaseForUser(userId: number, requestId: string, leaseMs = 150_000) {
  const db = await requireDb();
  const expiresAt = new Date(Date.now() + leaseMs);
  await db.insert(userAiRequestLocks).values({ userId, requestId, expiresAt }).onDuplicateKeyUpdate({
    set: {
      requestId: sql`IF(${userAiRequestLocks.expiresAt} <= NOW(), VALUES(${userAiRequestLocks.requestId}), ${userAiRequestLocks.requestId})`,
      expiresAt: sql`IF(${userAiRequestLocks.expiresAt} <= NOW(), VALUES(${userAiRequestLocks.expiresAt}), ${userAiRequestLocks.expiresAt})`,
    },
  });
  const rows = await db.select().from(userAiRequestLocks).where(eq(userAiRequestLocks.userId, userId)).limit(1);
  return rows[0]?.requestId === requestId;
}

export async function releaseAiRequestLeaseForUser(userId: number, requestId: string) {
  const db = await requireDb();
  await db.delete(userAiRequestLocks).where(and(eq(userAiRequestLocks.userId, userId), eq(userAiRequestLocks.requestId, requestId)));
}

export async function attachBackgroundTaskInteractionForUser(input: { userId: number; projectId: string; taskId: string; interactionId: string; model?: string; status: BackgroundTaskState; progress: string }) {
  const db = await requireDb();
  await db.update(projectBackgroundTasks).set({ providerInteractionId: input.interactionId, providerModel: input.model ?? null, status: input.status, progress: input.progress }).where(and(eq(projectBackgroundTasks.id, input.taskId), eq(projectBackgroundTasks.userId, input.userId), eq(projectBackgroundTasks.projectId, input.projectId)));
  return getBackgroundTaskForUser(input.userId, input.projectId, input.taskId);
}

/** Claims one Gemini task for a server-side fallback. Matching the original
 * interaction ID prevents concurrent polling requests from invoking the rescue twice. */
export async function claimBackgroundTaskRescueForUser(input: { userId: number; projectId: string; taskId: string; geminiInteractionId?: string | null; progress: string }) {
  const db = await requireDb();
  const rescueInteractionId = `gemini-rescue:${input.taskId}`;
  const result = await db.update(projectBackgroundTasks).set({
    providerInteractionId: rescueInteractionId,
    providerModel: "gemini-rescue",
    status: "in_progress",
    progress: input.progress,
  }).where(and(
    eq(projectBackgroundTasks.id, input.taskId),
    eq(projectBackgroundTasks.userId, input.userId),
    eq(projectBackgroundTasks.projectId, input.projectId),
    input.geminiInteractionId ? eq(projectBackgroundTasks.providerInteractionId, input.geminiInteractionId) : isNull(projectBackgroundTasks.providerInteractionId),
  ));
  return Number((result as unknown as { affectedRows?: number }).affectedRows || 0) > 0;
}

export async function updateBackgroundTaskForUser(input: { userId: number; projectId: string; taskId: string; status: BackgroundTaskState; progress: string; providerModel?: string | null; failureMessage?: string | null; resultSummary?: string | null; resultVersionId?: string | null; cancelledAt?: Date | null; completedAt?: Date | null }) {
  const db = await requireDb();
  await db.update(projectBackgroundTasks).set({
    status: input.status,
    progress: input.progress,
    ...(input.providerModel === undefined ? {} : { providerModel: input.providerModel }),
    failureMessage: input.failureMessage ?? null,
    resultSummary: input.resultSummary ?? null,
    resultVersionId: input.resultVersionId ?? null,
    cancelledAt: input.cancelledAt ?? null,
    completedAt: input.completedAt ?? null,
  }).where(and(eq(projectBackgroundTasks.id, input.taskId), eq(projectBackgroundTasks.userId, input.userId), eq(projectBackgroundTasks.projectId, input.projectId)));
  return getBackgroundTaskForUser(input.userId, input.projectId, input.taskId);
}

export async function getProjectDomainForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const rows = await db.select().from(projectDomains).where(and(eq(projectDomains.userId, userId), eq(projectDomains.projectId, projectId))).limit(1);
  return rows[0];
}

export async function upsertProjectDomainForUser({ userId, projectId, hostname }: { userId: number; projectId: string; hostname: string }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projectDomains).values({ id, userId, projectId, hostname, registrar: "namecom", status: "awaiting_connection" }).onDuplicateKeyUpdate({
    set: { hostname, registrar: "namecom", status: "awaiting_connection" },
  });
  return getProjectDomainForUser(userId, projectId);
}

export async function saveInitialVisualReferenceForUser({
  userId,
  projectId,
  key,
  mimeType,
}: {
  userId: number;
  projectId: string;
  key: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}) {
  const db = await requireDb();
  await db
    .insert(projectInitialVisualReferences)
    .values({ projectId, userId, key, mimeType })
    .onDuplicateKeyUpdate({ set: { key, mimeType } });
}

export async function getInitialVisualReferenceForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const rows = await db
    .select({ key: projectInitialVisualReferences.key, mimeType: projectInitialVisualReferences.mimeType })
    .from(projectInitialVisualReferences)
    .where(and(eq(projectInitialVisualReferences.userId, userId), eq(projectInitialVisualReferences.projectId, projectId)))
    .limit(1);
  return rows[0];
}

export async function createProjectAgentActionForUser(input: {
  userId: number;
  projectId: string;
  type: "clarify" | "plan" | "modify" | "confirm";
  impact: "safe" | "moderate" | "high";
  instruction: string;
  summary: string;
  status?: "awaiting_confirmation" | "confirmed" | "cancelled" | "executed";
}) {
  const db = await requireDb();
  const project = await getProjectForUser(input.userId, input.projectId);
  if (!project) return undefined;
  const id = nanoid();
  await db.insert(projectAgentActions).values({ id, ...input, status: input.status ?? "awaiting_confirmation" });
  return getProjectAgentActionForUser(input.userId, input.projectId, id);
}

export async function getProjectAgentActionForUser(userId: number, projectId: string, actionId: string) {
  const db = await requireDb();
  const rows = await db.select().from(projectAgentActions).where(and(eq(projectAgentActions.id, actionId), eq(projectAgentActions.userId, userId), eq(projectAgentActions.projectId, projectId))).limit(1);
  return rows[0];
}

export async function getPendingProjectAgentActionForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const rows = await db.select().from(projectAgentActions).where(and(eq(projectAgentActions.userId, userId), eq(projectAgentActions.projectId, projectId), eq(projectAgentActions.status, "awaiting_confirmation"))).orderBy(desc(projectAgentActions.updatedAt)).limit(1);
  return rows[0];
}

export async function listProjectAgentActionsForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db
    .select({ id: projectAgentActions.id, type: projectAgentActions.type, impact: projectAgentActions.impact, status: projectAgentActions.status, summary: projectAgentActions.summary, updatedAt: projectAgentActions.updatedAt })
    .from(projectAgentActions)
    .where(and(eq(projectAgentActions.userId, userId), eq(projectAgentActions.projectId, projectId)))
    .orderBy(desc(projectAgentActions.updatedAt))
    .limit(12);
}

export async function updateProjectAgentActionStatusForUser(input: {
  userId: number;
  projectId: string;
  actionId: string;
  status: "awaiting_confirmation" | "confirmed" | "cancelled" | "executed";
}) {
  const db = await requireDb();
  await db.update(projectAgentActions).set({ status: input.status }).where(and(eq(projectAgentActions.id, input.actionId), eq(projectAgentActions.userId, input.userId), eq(projectAgentActions.projectId, input.projectId)));
  return getProjectAgentActionForUser(input.userId, input.projectId, input.actionId);
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

export async function getRunnerJobById(jobId: string) {
  const db = await requireDb();
  const result = await db.select().from(projectRunnerJobs).where(eq(projectRunnerJobs.id, jobId)).limit(1);
  return result[0];
}

export async function listRunnerJobsForUser(userId: number, projectId: string) {
  const db = await requireDb();
  return db.select({ id: projectRunnerJobs.id, projectId: projectRunnerJobs.projectId, userId: projectRunnerJobs.userId, state: projectRunnerJobs.state, artifact: projectRunnerJobs.artifact, expiresAt: projectRunnerJobs.expiresAt, createdAt: projectRunnerJobs.createdAt, updatedAt: projectRunnerJobs.updatedAt })
    .from(projectRunnerJobs)
    .where(and(eq(projectRunnerJobs.userId, userId), eq(projectRunnerJobs.projectId, projectId)))
    .orderBy(desc(projectRunnerJobs.createdAt));
}

export async function getMobileBrandingForUser(userId: number, projectId: string): Promise<MobileBranding | null> {
  const db = await requireDb();
  const result = await db.select().from(projectMobileBranding).where(and(eq(projectMobileBranding.userId, userId), eq(projectMobileBranding.projectId, projectId))).limit(1);
  const row = result[0];
  if (!row) return null;
  return {
    icon: row.iconKey && row.iconUrl && row.iconFilename && row.iconWidth && row.iconHeight ? { key: row.iconKey, url: row.iconUrl, filename: row.iconFilename, width: row.iconWidth, height: row.iconHeight } : null,
    splash: row.splashKey && row.splashUrl && row.splashFilename && row.splashWidth && row.splashHeight ? { key: row.splashKey, url: row.splashUrl, filename: row.splashFilename, width: row.splashWidth, height: row.splashHeight } : null,
  };
}

export async function getMobileBuildAuthorizationForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const result = await db.select().from(projectMobileBuildAuthorizations).where(and(eq(projectMobileBuildAuthorizations.userId, userId), eq(projectMobileBuildAuthorizations.projectId, projectId))).limit(1);
  return result[0];
}

export async function grantSimulatedMobileBuildAuthorizationForUser(userId: number, projectId: string) {
  const db = await requireDb();
  const project = await getProjectForUser(userId, projectId);
  if (!project) return undefined;
  const providerReference = `simulated_mobile_build:${userId}:${projectId}`;
  await db.insert(projectMobileBuildAuthorizations).values({ id: nanoid(), userId, projectId, status: "simulated_paid", amountUsdCents: 700, providerReference }).onDuplicateKeyUpdate({ set: { status: "simulated_paid", amountUsdCents: 700, providerReference } });
  return getMobileBuildAuthorizationForUser(userId, projectId);
}

export async function saveMobileBrandingForUser({ userId, projectId, kind, asset }: { userId: number; projectId: string; kind: "icon" | "splash"; asset: MobileBrandingAsset }) {
  const db = await requireDb();
  const current = await getMobileBrandingForUser(userId, projectId);
  const values = {
    iconKey: kind === "icon" ? asset.key : current?.icon?.key ?? null,
    iconUrl: kind === "icon" ? asset.url : current?.icon?.url ?? null,
    iconFilename: kind === "icon" ? asset.filename : current?.icon?.filename ?? null,
    iconWidth: kind === "icon" ? asset.width : current?.icon?.width ?? null,
    iconHeight: kind === "icon" ? asset.height : current?.icon?.height ?? null,
    splashKey: kind === "splash" ? asset.key : current?.splash?.key ?? null,
    splashUrl: kind === "splash" ? asset.url : current?.splash?.url ?? null,
    splashFilename: kind === "splash" ? asset.filename : current?.splash?.filename ?? null,
    splashWidth: kind === "splash" ? asset.width : current?.splash?.width ?? null,
    splashHeight: kind === "splash" ? asset.height : current?.splash?.height ?? null,
  };
  const existing = await db.select({ projectId: projectMobileBranding.projectId }).from(projectMobileBranding).where(and(eq(projectMobileBranding.userId, userId), eq(projectMobileBranding.projectId, projectId))).limit(1);
  if (existing[0]) await db.update(projectMobileBranding).set(values).where(and(eq(projectMobileBranding.userId, userId), eq(projectMobileBranding.projectId, projectId)));
  else await db.insert(projectMobileBranding).values({ projectId, userId, ...values });
  return getMobileBrandingForUser(userId, projectId);
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

export async function updateRunnerJobArtifactForUser({ userId, projectId, jobId, artifact }: { userId: number; projectId: string; jobId: string; artifact: RunnerArtifact }) {
  const db = await requireDb();
  await db.update(projectRunnerJobs).set({ artifact }).where(and(eq(projectRunnerJobs.id, jobId), eq(projectRunnerJobs.projectId, projectId), eq(projectRunnerJobs.userId, userId)));
  return getRunnerJobForUser(userId, projectId, jobId);
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

export const WELCOME_CREDIT_AMOUNT = 13;

export async function grantWelcomeCreditsForUser(userId: number) {
  const db = await requireDb();
  const idempotencyKey = `welcome_credit:${userId}`;
  return db.transaction(async tx => {
    const existing = await tx.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) return { granted: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
    await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
    await tx.update(creditBalances).set({ balance: sql`${creditBalances.balance} + ${WELCOME_CREDIT_AMOUNT}` }).where(eq(creditBalances.userId, userId));
    const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
    const balanceAfter = balance[0]?.balance;
    if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after welcome grant.");
    await tx.insert(creditLedger).values({
      id: nanoid(),
      userId,
      kind: "adjustment",
      amount: WELCOME_CREDIT_AMOUNT,
      balanceAfter,
      operation: "welcome_credit",
      idempotencyKey,
    });
    return { granted: true, duplicate: false, balanceAfter };
  });
}

export async function recordAiGenerationUsage({ userId, projectId, operation, provider, model, promptTokens, candidateTokens, totalTokens, creditsCharged, requestId }: { userId: number; projectId?: string; operation: string; provider: string; model: string; promptTokens: number; candidateTokens: number; totalTokens: number; creditsCharged: number; requestId: string }) {
  const db = await requireDb();
  const asNonNegativeInteger = (value: number) => Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  const asNonNegativeCredits = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 1_000) / 1_000) : 0;
  await db.insert(aiGenerationUsage).values({
    id: nanoid(),
    userId,
    projectId: projectId ?? null,
    operation,
    provider,
    model,
    promptTokens: asNonNegativeInteger(promptTokens),
    candidateTokens: asNonNegativeInteger(candidateTokens),
    totalTokens: asNonNegativeInteger(totalTokens),
    creditsCharged: asNonNegativeCredits(creditsCharged),
    requestId,
  }).onDuplicateKeyUpdate({ set: { requestId } });
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
  const requestedCredits = Number.isFinite(credits) ? Math.round(credits * 1_000) / 1_000 : 0;
  if (requestedCredits <= 0) throw new Error("Credit consumption must be positive.");
  const db = await requireDb();
  try {
    return await db.transaction(async tx => {
      const existing = await tx.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
      if (existing[0]) return { consumed: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
      await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
      const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).for("update").limit(1);
      const balanceBefore = balance[0]?.balance ?? 0;
      if (balanceBefore <= 0) return { consumed: false, insufficient: true, balanceAfter: 0 };
      const chargedCredits = Math.min(balanceBefore, requestedCredits);
      const balanceAfter = Math.max(0, Math.round((balanceBefore - chargedCredits) * 1_000) / 1_000);
      await tx.update(creditBalances).set({ balance: balanceAfter }).where(eq(creditBalances.userId, userId));
      if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after usage.");
      await tx.insert(creditLedger).values({ id: nanoid(), userId, kind: "usage", amount: -chargedCredits, balanceAfter, operation, idempotencyKey });
      return { consumed: true, duplicate: false, chargedCredits, balanceAfter };
    });
  } catch (error) {
    const existing = await db.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, idempotencyKey)).limit(1);
    if (existing[0]) return { consumed: false, duplicate: true, balanceAfter: existing[0].balanceAfter };
    throw error;
  }
}

export async function refundCreditForUser({ userId, credits, operation, idempotencyKey }: { userId: number; credits: number; operation: string; idempotencyKey: string }) {
  const refundedCredits = Number.isFinite(credits) ? Math.round(credits * 1_000) / 1_000 : 0;
  if (refundedCredits <= 0) throw new Error("Credit refund must be positive.");
  const db = await requireDb();
  const refundKey = `refund:${idempotencyKey}`;
  return db.transaction(async tx => {
    const existingRefund = await tx.select({ balanceAfter: creditLedger.balanceAfter }).from(creditLedger).where(eq(creditLedger.idempotencyKey, refundKey)).limit(1);
    if (existingRefund[0]) return { refunded: false, duplicate: true, balanceAfter: existingRefund[0].balanceAfter };
    await tx.insert(creditBalances).values({ userId, balance: 0 }).onDuplicateKeyUpdate({ set: { userId } });
    await tx.update(creditBalances).set({ balance: sql`${creditBalances.balance} + ${refundedCredits}` }).where(eq(creditBalances.userId, userId));
    const balance = await tx.select({ balance: creditBalances.balance }).from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
    const balanceAfter = balance[0]?.balance;
    if (typeof balanceAfter !== "number") throw new Error("Credit balance could not be read after refund.");
    await tx.insert(creditLedger).values({ id: nanoid(), userId, kind: "adjustment", amount: refundedCredits, balanceAfter, operation: `provider_refund:${operation}`, idempotencyKey: refundKey });
    return { refunded: true, duplicate: false, balanceAfter };
  });
}
