import { decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { BuilderFile } from "../shared/builder";
import type { ProjectPlan } from "../shared/project";
import type { FullStackRunnerManifest, RunnerStatusEvent } from "../shared/runner";
import type { RunnerArtifact, RunnerJobState, RunnerLogLevel } from "../shared/runnerJobs";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const localAuthAccounts = mysqlTable("localAuthAccounts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  failedAttempts: int("failedAttempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  passwordUpdatedAt: timestamp("passwordUpdatedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectStatus = mysqlEnum("projectStatus", ["draft", "generating", "ready"]);
export const projectTarget = mysqlEnum("projectTarget", ["web", "mobile"]);
export const messageRole = mysqlEnum("messageRole", ["user", "assistant"]);
export const builderFileLanguage = mysqlEnum("builderFileLanguage", ["html", "css", "javascript"]);
export const builderVersionOrigin = mysqlEnum("builderVersionOrigin", ["generate", "restore", "edit"]);
export const creditLedgerKind = mysqlEnum("creditLedgerKind", ["purchase", "usage", "adjustment"]);
export const adminCreditPackageDraftStatus = mysqlEnum("adminCreditPackageDraftStatus", ["draft", "approved"]);
export const runnerExecutionMode = mysqlEnum("runnerExecutionMode", ["static", "full_stack_runner"]);
export const runnerProfileStatus = mysqlEnum("runnerProfileStatus", ["static_preview_ready", "runner_required", "runner_connected", "build_queued", "build_failed"]);
export const runnerJobState = mysqlEnum("runnerJobState", ["queued", "runner_assigned", "installing", "building", "testing", "preview_ready", "failed", "expired", "cancelled"]);
export const runnerLogLevel = mysqlEnum("runnerLogLevel", ["info", "warning", "error", "success"]);
export const mobileBuildAuthorizationStatus = mysqlEnum("mobileBuildAuthorizationStatus", ["simulated_paid", "stripe_paid", "revoked"]);

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description").notNull(),
    target: projectTarget.notNull().default("web"),
    status: projectStatus.notNull().default("draft"),
    generatedPlan: json("generatedPlan").$type<ProjectPlan | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("projects_user_created_idx").on(table.userId, table.createdAt)]
);

export const projectMessages = mysqlTable(
  "projectMessages",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    sequence: int("sequence").notNull().default(0),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: messageRole.notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_messages_project_sequence_idx").on(table.projectId, table.sequence)]
);

export const projectMessageSequences = mysqlTable("projectMessageSequences", {
  projectId: varchar("projectId", { length: 32 }).primaryKey().references(() => projects.id, { onDelete: "cascade" }),
  nextSequence: int("nextSequence").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectInitialVisualReferences = mysqlTable(
  "projectInitialVisualReferences",
  {
    projectId: varchar("projectId", { length: 32 }).primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 512 }).notNull(),
    mimeType: varchar("mimeType", { length: 32 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("initial_visual_reference_user_project_idx").on(table.userId, table.projectId)]
);

export const projectFiles = mysqlTable(
  "projectFiles",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    path: varchar("path", { length: 180 }).notNull(),
    language: builderFileLanguage.notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("project_files_project_path_unique").on(table.projectId, table.path),
    index("project_files_user_project_idx").on(table.userId, table.projectId),
  ]
);

export const projectPreviewShares = mysqlTable(
  "projectPreviewShares",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_preview_shares_project_active_idx").on(table.projectId, table.revokedAt, table.expiresAt)]
);

export const projectBuildVersions = mysqlTable(
  "projectBuildVersions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    instruction: text("instruction"),
    summary: text("summary"),
    origin: builderVersionOrigin.notNull(),
    files: json("files").$type<BuilderFile[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_build_versions_user_project_idx").on(table.userId, table.projectId, table.createdAt)]
);

export const projectMobileBranding = mysqlTable(
  "projectMobileBranding",
  {
    projectId: varchar("projectId", { length: 32 }).primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    iconKey: varchar("iconKey", { length: 512 }),
    iconUrl: varchar("iconUrl", { length: 1024 }),
    iconFilename: varchar("iconFilename", { length: 255 }),
    iconWidth: int("iconWidth"),
    iconHeight: int("iconHeight"),
    splashKey: varchar("splashKey", { length: 512 }),
    splashUrl: varchar("splashUrl", { length: 1024 }),
    splashFilename: varchar("splashFilename", { length: 255 }),
    splashWidth: int("splashWidth"),
    splashHeight: int("splashHeight"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("mobile_branding_user_project_idx").on(table.userId, table.projectId)]
);

export const projectRunnerProfiles = mysqlTable(
  "projectRunnerProfiles",
  {
    projectId: varchar("projectId", { length: 32 }).primaryKey().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    mode: runnerExecutionMode.notNull().default("static"),
    status: runnerProfileStatus.notNull().default("static_preview_ready"),
    manifest: json("manifest").$type<FullStackRunnerManifest | null>(),
    diagnostics: json("diagnostics").$type<string[] | null>(),
    events: json("events").$type<RunnerStatusEvent[] | null>(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("runner_profiles_user_project_idx").on(table.userId, table.projectId)]
);

export const projectRunnerJobs = mysqlTable(
  "projectRunnerJobs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    state: runnerJobState.notNull().default("queued"),
    artifact: json("artifact").$type<RunnerArtifact>().notNull(),
    handoffTokenHash: varchar("handoffTokenHash", { length: 128 }).notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("runner_jobs_user_project_created_idx").on(table.userId, table.projectId, table.createdAt)]
);

export const projectRunnerJobLogs = mysqlTable(
  "projectRunnerJobLogs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    jobId: varchar("jobId", { length: 32 }).notNull().references(() => projectRunnerJobs.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    level: runnerLogLevel.notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("runner_job_logs_user_job_created_idx").on(table.userId, table.jobId, table.createdAt)]
);

export const projectMobileBuildAuthorizations = mysqlTable(
  "projectMobileBuildAuthorizations",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: mobileBuildAuthorizationStatus.notNull(),
    amountUsdCents: int("amountUsdCents").notNull().default(700),
    providerReference: varchar("providerReference", { length: 255 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("mobile_build_authorization_user_project_unique").on(table.userId, table.projectId), index("mobile_build_authorization_project_idx").on(table.projectId)]
);

export const creditBalances = mysqlTable("creditBalances", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: decimal("balance", { precision: 12, scale: 3, mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const adminCreditPackageDrafts = mysqlTable(
  "adminCreditPackageDrafts",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    label: varchar("label", { length: 120 }).notNull(),
    credits: decimal("credits", { precision: 12, scale: 3, mode: "number" }).notNull(),
    stripePriceId: varchar("stripePriceId", { length: 255 }),
    status: adminCreditPackageDraftStatus.notNull().default("draft"),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("admin_credit_package_drafts_updated_idx").on(table.updatedAt)]
);

export const creditLedger = mysqlTable(
  "creditLedger",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: creditLedgerKind.notNull(),
    amount: decimal("amount", { precision: 12, scale: 3, mode: "number" }).notNull(),
    balanceAfter: decimal("balanceAfter", { precision: 12, scale: 3, mode: "number" }).notNull(),
    operation: varchar("operation", { length: 80 }),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).unique(),
    stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).unique(),
    sourceEventId: varchar("sourceEventId", { length: 255 }).unique(),
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("credit_ledger_user_created_idx").on(table.userId, table.createdAt)]
);

export const aiGenerationUsage = mysqlTable(
  "aiGenerationUsage",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("projectId", { length: 32 }).references(() => projects.id, { onDelete: "set null" }),
    operation: varchar("operation", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 40 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    promptTokens: int("promptTokens").notNull().default(0),
    candidateTokens: int("candidateTokens").notNull().default(0),
    totalTokens: int("totalTokens").notNull().default(0),
    creditsCharged: decimal("creditsCharged", { precision: 12, scale: 3, mode: "number" }).notNull().default(0),
    requestId: varchar("requestId", { length: 128 }).notNull().unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ai_generation_usage_user_created_idx").on(table.userId, table.createdAt), index("ai_generation_usage_project_created_idx").on(table.projectId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectMessage = typeof projectMessages.$inferSelect;
