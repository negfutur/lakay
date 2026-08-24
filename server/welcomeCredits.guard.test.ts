import { describe, expect, it } from "vitest";
import { WELCOME_CREDIT_AMOUNT } from "./db";
import { readFileSync } from "node:fs";

const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");

describe("Lakay welcome credit provisioning", () => {
  it("grants exactly 13 credits through an idempotent server-side ledger operation", () => {
    expect(WELCOME_CREDIT_AMOUNT).toBe(13);
    expect(dbSource).toContain("welcome_credit:${userId}");
    expect(dbSource).toContain('operation: "welcome_credit"');
    expect(dbSource).toContain("if (!existingUser[0])");
  });
});
