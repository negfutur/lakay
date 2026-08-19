import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import type { BuilderFile } from "../shared/builder";
import type { ProjectPlan } from "../shared/project";

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

export const projectStatus = mysqlEnum("projectStatus", ["draft", "generating", "ready"]);
export const messageRole = mysqlEnum("messageRole", ["user", "assistant"]);
export const builderFileLanguage = mysqlEnum("builderFileLanguage", ["html", "css", "javascript"]);
export const builderVersionOrigin = mysqlEnum("builderVersionOrigin", ["generate", "restore", "edit"]);
export const creditLedgerKind = mysqlEnum("creditLedgerKind", ["purchase", "usage", "adjustment"]);

export const projects = mysqlTable(
  "projects",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description").notNull(),
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
    projectId: varchar("projectId", { length: 32 }).notNull().references(() => projects.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: messageRole.notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("project_messages_project_created_idx").on(table.projectId, table.createdAt)]
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

export const creditBalances = mysqlTable("creditBalances", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  balance: int("balance").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const creditLedger = mysqlTable(
  "creditLedger",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: creditLedgerKind.notNull(),
    amount: int("amount").notNull(),
    balanceAfter: int("balanceAfter").notNull(),
    operation: varchar("operation", { length: 80 }),
    stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }).unique(),
    stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).unique(),
    sourceEventId: varchar("sourceEventId", { length: 255 }).unique(),
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("credit_ledger_user_created_idx").on(table.userId, table.createdAt)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectMessage = typeof projectMessages.$inferSelect;
