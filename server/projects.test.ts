import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  listProjectsForUser: vi.fn(),
  createProject: vi.fn(),
  recordAiGenerationUsage: vi.fn(),
  getCreditBalanceForUser: vi.fn(),
  consumeCreditForUser: vi.fn(),
  refundCreditForUser: vi.fn(),
  createProjectMessage: vi.fn(),
  getProjectForUser: vi.fn(),
  listProjectMessagesForUser: vi.fn(),
  updateProjectForUser: vi.fn(),
  deleteProjectForUser: vi.fn(),
  saveInitialVisualReferenceForUser: vi.fn(),
}));

vi.mock("./projectPlanning", () => ({
  generateProjectPlanWithUsage: vi.fn(),
}));

vi.mock("./storage", () => ({ storagePut: vi.fn() }));

import * as db from "./db";
import { generateProjectPlanWithUsage } from "./projectPlanning";
import { projectsRouter } from "./projects";
import { storagePut } from "./storage";

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
  vi.mocked(db.getCreditBalanceForUser).mockResolvedValue({ userId: 1, balance: 13, updatedAt: new Date() } as never);
  vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, chargedCredits: 10, balanceAfter: 20 } as never);
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
    expect(generateProjectPlanWithUsage).toHaveBeenCalledWith(project.description, undefined);
    expect(db.createProject).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, plan }));
    expect(db.recordAiGenerationUsage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, operation: "project_plan", model: "gemini-2.5-pro" }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "user" }));
    expect(db.createProjectMessage).toHaveBeenCalledWith(expect.objectContaining({ projectId: project.id, userId: 1, role: "assistant" }));
    expect(db.createProjectMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ role: "user", content: "A sufficiently descriptive product concept for testing." }));
    expect(db.createProjectMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ role: "assistant", content: expect.stringContaining("[[lakay:open-preview]]") }));
    expect(db.getProjectForUser).toHaveBeenCalledWith(1, project.id);
    expect(db.updateProjectForUser).toHaveBeenCalledWith(1, project.id, { name: "Renamed" });
    expect(db.deleteProjectForUser).toHaveBeenCalledWith(1, project.id);
  });

  it("does not debit welcome credits when initial planning fails before project creation", async () => {
    const caller = projectsRouter.createCaller(contextFor(1));
    vi.mocked(generateProjectPlanWithUsage).mockRejectedValue(new Error("Temporary provider failure"));

    await expect(caller.create({ description: project.description, requestId: "44444444-4444-4444-8444-444444444444" })).rejects.toBeDefined();

    expect(db.consumeCreditForUser).not.toHaveBeenCalled();
    expect(db.createProject).not.toHaveBeenCalled();
  });

  it("accepts a concise first idea so Lakay can apply intelligent defaults during planning", async () => {
    const caller = projectsRouter.createCaller(contextFor(1));
    vi.mocked(generateProjectPlanWithUsage).mockResolvedValue({ plan, model: "gemini-2.5-pro", usage: { prompt_tokens: 50, completion_tokens: 60, total_tokens: 110 } });
    vi.mocked(db.createProject).mockResolvedValue(project as never);
    vi.mocked(db.createProjectMessage).mockResolvedValue({ id: "message-short-idea" });

    await expect(caller.create({ description: "Hôtel", requestId: "55555555-5555-4555-8555-555555555555" })).resolves.toEqual(project);

    expect(generateProjectPlanWithUsage).toHaveBeenCalledWith("Hôtel", undefined);
    expect(db.createProject).toHaveBeenCalledWith(expect.objectContaining({ description: "Hôtel" }));
  });

  it("accepts a bounded initial image, sends it to planning, and retains it under the project owner only", async () => {
    const caller = projectsRouter.createCaller(contextFor(1));
    vi.mocked(generateProjectPlanWithUsage).mockResolvedValue({ plan, model: "gemini-2.5-pro", usage: { prompt_tokens: 80, completion_tokens: 90, total_tokens: 170 } });
    vi.mocked(db.createProject).mockResolvedValue(project as never);
    vi.mocked(db.createProjectMessage).mockResolvedValue({ id: "message-image" });
    vi.mocked(storagePut).mockResolvedValue({ key: "initial-attachments/1/project-one/reference_hash.png", url: "/manus-storage/initial" });

    await expect(caller.create({ description: "Une vitrine", requestId: "66666666-6666-4666-8666-666666666666", initialImage: { mimeType: "image/png", base64: "iVBORw0KGgo=" } })).resolves.toEqual(project);

    expect(generateProjectPlanWithUsage).toHaveBeenCalledWith("Une vitrine", "data:image/png;base64,iVBORw0KGgo=");
    expect(storagePut).toHaveBeenCalledWith("initial-attachments/1/project-one/reference.png", expect.any(Buffer), "image/png");
    expect(db.saveInitialVisualReferenceForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: "project-one", key: "initial-attachments/1/project-one/reference_hash.png", mimeType: "image/png" }));
  });

  it("rejects an initial image whose declared type does not match its content", async () => {
    const caller = projectsRouter.createCaller(contextFor(1));
    await expect(caller.create({ description: "Une vitrine", requestId: "77777777-7777-4777-8777-777777777777", initialImage: { mimeType: "image/jpeg", base64: "iVBORw0KGgo=" } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(generateProjectPlanWithUsage).not.toHaveBeenCalled();
    expect(db.createProject).not.toHaveBeenCalled();
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
