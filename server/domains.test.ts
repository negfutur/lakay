import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getProjectForUser: vi.fn(), getProjectDomainForUser: vi.fn(), upsertProjectDomainForUser: vi.fn() }));

import { domainsRouter } from "./domains";
import * as db from "./db";

const contextFor = (userId: number) => ({ user: { id: userId, openId: `user-${userId}`, role: "user", email: "member@example.test", name: "Member" }, req: {}, res: {} } as never);
const project = { id: "project-domain", userId: 1, name: "Lakay Studio", description: "A polished web application." };

describe("Lakay domain-launch router", () => {
  beforeEach(() => {
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.getProjectDomainForUser).mockResolvedValue(undefined as never);
  });

  it("returns suggestions and a safe partner handoff without claiming live availability or exposing credentials", async () => {
    const result = await domainsRouter.createCaller(contextFor(1)).get({ projectId: project.id });
    expect(result.suggestions).toContain("lakaystudio.com");
    expect(result.partner).toMatchObject({ name: "Name.com", checkoutUrl: "https://www.name.com/" });
    expect(result.dnsReady).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/token|secret|available|purchased/i);
  });

  it("persists a normalized user-owned domain only after project ownership is verified", async () => {
    vi.mocked(db.upsertProjectDomainForUser).mockResolvedValue({ hostname: "studio.example.com", status: "awaiting_connection" } as never);
    await domainsRouter.createCaller(contextFor(1)).claim({ projectId: project.id, hostname: "https://Studio.Example.com/" });
    expect(db.upsertProjectDomainForUser).toHaveBeenCalledWith({ userId: 1, projectId: project.id, hostname: "studio.example.com" });
  });

  it("rejects invalid hostnames and cannot persist a domain for an unavailable project", async () => {
    await expect(domainsRouter.createCaller(contextFor(1)).claim({ projectId: project.id, hostname: "not a domain" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(db.getProjectForUser).mockResolvedValue(undefined as never);
    await expect(domainsRouter.createCaller(contextFor(1)).claim({ projectId: project.id, hostname: "studio.example.com" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
