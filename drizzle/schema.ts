import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type ProjectMessage = typeof projectMessages.$inferSelect;
