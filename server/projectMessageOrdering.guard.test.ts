import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

describe("Lakay project message chronology", () => {
  it("allocates a per-project sequence inside a locked transaction before inserting each message", () => {
    expect(schemaSource).toContain('export const projectMessageSequences');
    expect(schemaSource).toContain('sequence: int("sequence").notNull().default(0)');
    expect(dbSource).toContain("return db.transaction(async tx => {");
    expect(dbSource).toContain("projectMessageSequences.nextSequence");
    expect(dbSource).toContain('.for("update")');
    expect(dbSource).toContain("values({ id, projectId, userId, role, content, sequence })");
  });

  it("reads stored messages in persistent sequence order with stable legacy fallbacks", () => {
    expect(dbSource).toContain("sequence: projectMessages.sequence");
    expect(dbSource).toContain("orderBy(asc(projectMessages.sequence), asc(projectMessages.createdAt), asc(projectMessages.role), asc(projectMessages.id))");
  });
});
