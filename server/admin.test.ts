import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getAdminOverview: vi.fn() }));

import { adminRouter } from "./admin";
import * as db from "./db";

const overview = { totals: { users: 2, projects: 3, generations: 4, mobileJobs: 1 }, recentUsers: [], recentJobs: [] };
const contextFor = (role: "admin" | "user") => ({ user: { id: 1, openId: "user-1", role, email: "admin@example.test", name: "Admin" }, req: {}, res: {} } as never);

describe("administrator control center", () => {
  beforeEach(() => vi.mocked(db.getAdminOverview).mockResolvedValue(overview as never));

  it("denies the overview to ordinary members", async () => {
    await expect(adminRouter.createCaller(contextFor("user")).overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns aggregate operational data without secrets to administrators", async () => {
    const result = await adminRouter.createCaller(contextFor("admin")).overview();
    expect(result.totals).toEqual(overview.totals);
    expect(JSON.stringify(result)).not.toMatch(/secret|token|key/i);
  });
});
