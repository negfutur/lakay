import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listProjectsForUser: vi.fn(),
  createProject: vi.fn(),
  recordAiGenerationUsage: vi.fn(),
  consumeCreditForUser: vi.fn(),
  refundCreditForUser: vi.fn(),
  createProjectMessage: vi.fn(),
  getProjectForUser: vi.fn(),
  listProjectMessagesForUser: vi.fn(),
  updateProjectForUser: vi.fn(),
  deleteProjectForUser: vi.fn(),
}));

vi.mock("./projectPlanning", () => ({
  generateProjectPlanWithUsage: vi.fn(),
}));

import * as db from "./db";
import { generateProjectPlanWithUsage } from "./projectPlanning";
import { projectsRouter } from "./projects";

const project = {
  id: "project-one",
  userId: 1,
  name: "Northstar",
  description: "A sufficiently descriptive product concept for testing.",
  status: "ready",
  generatedPlan: null,
  createdAt: new Date("2026-08-19T00:00:00.000Z"),
  updatedAt: new Date("2026-08-19T00:00:00.000Z"),
};

const plan = {
  name: "Northstar",
  tagline: "A crisp product direction.",
  summary: "A structured product plan.",
  goals: ["Focus"],
  features: ["Project briefs"],
  techStack: [{ category: "Frontend", name: "React", reason: "Interface delivery" }],
  components: [{ name: "Workspace", purpose: "Plan refinement" }],
  milestones: ["Define the first release"],
};

function contextFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: `User ${userId}`,
      email: `user-${userId}@example.com`,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, balanceAfter: 20 } as never);
});

afterEach(() => vi.clearAllMocks());

describe("projects router operations", () => {
  it("lists, creates, reads, updates, and deletes projects only with the signed-in user id", async () => {
    const caller = projectsRouter.createCaller(contextFor(1));
    vi.mocked(db.listProjectsForUser).mockResolvedValue([project] as never);
    vi.mocked(generateProjectPlanWithUsage).mockResolvedValue({ plan, model: "gemini-2.5-pro", usage: { prompt_tokens: 100, completion_tokens: 150, total_tokens: 250 } });
    vi.mocked(db.createProject).mockResolvedValue(project as never);
    vi.mocked(db.createProjectMessage).mockResolvedValue({ id: "message-one" });
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listProjectMessagesForUser).mockResolvedValue([] as never);
    vi.mocked(db.updateProjectForUser).mockResolvedValue({ ...project, name: "Renamed" } as never);
    vi.mocked(db.deleteProjectForUser).mockResolvedValue(true);

    await expect(caller.list()).resolves.toEqual([project]);
    await expect(caller.create({ description: project.description, requestId: "33333333-3333-4333-8333-333333333333" })).resolves.toEqual(project);
    await expect(caller.get({ projectId: project.id })).resolves.toMatchObject({ ...project, messages: [] });
    await expect(caller.update({ projectId: project.id, name: "Renamed" })).resolves.toMatchObject({ name: "Renamed" });
    await expect(caller.delete({ projectId: project.id })).resolves.toEqual({ success: true });

    expect(db.listProjectsForUser).toHaveBeenCalledWith(1);
    expect(generateProjectPlanWithUsage).toHaveBeenCalledWith(project.description);
    expect(db.createProject).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, plan }));
    expect(db.recordAiGenerationUsage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, operation: "project_plan", model: "gemini-2.5-pro" }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "user" }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "assistant" }));
    expect(db.getProjectForUser).toHaveBeenCalledWith(1, project.id);
    expect(db.updateProjectForUser).toHaveBeenCalledWith(1, project.id, { name: "Renamed" });
    expect(db.deleteProjectForUser).toHaveBeenCalledWith(1, project.id);
  });
});

describe("projects router user isolation", () => {
  it("does not reveal another user's project or conversation messages", async () => {
    const caller = projectsRouter.createCaller(contextFor(2));
    vi.mocked(db.getProjectForUser).mockResolvedValue(undefined);

    await expect(caller.get({ projectId: project.id })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.getProjectForUser).toHaveBeenCalledWith(2, project.id);
    expect(db.listProjectMessagesForUser).not.toHaveBeenCalled();
  });

  it("does not allow another user to update or delete a project", async () => {
    const caller = projectsRouter.createCaller(contextFor(2));
    vi.mocked(db.updateProjectForUser).mockResolvedValue(undefined);
    vi.mocked(db.deleteProjectForUser).mockResolvedValue(false);

    await expect(caller.update({ projectId: project.id, name: "Attempted change" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.delete({ projectId: project.id })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.updateProjectForUser).toHaveBeenCalledWith(2, project.id, { name: "Attempted change" });
    expect(db.deleteProjectForUser).toHaveBeenCalledWith(2, project.id);
  });
});
