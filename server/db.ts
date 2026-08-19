import { and, asc, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import type { ProjectPlan } from "../shared/project";
import { InsertUser, projectMessages, projects, users } from "../drizzle/schema";
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
