import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  getRunnerProfileForUser: vi.fn(),
  listRunnerJobsForUser: vi.fn(),
  listBackgroundTasksForUser: vi.fn(),
  listRunnerJobLogsForUser: vi.fn(),
  getMobileBrandingForUser: vi.fn(),
  replaceBuilderFilesForUser: vi.fn(),
  createProjectMessage: vi.fn(),
  listProjectMessagesForUser: vi.fn(),
}));

import * as db from "./db";
import { builderRouter } from "./builder";
import { makePreviewDocument } from "../client/src/lib/staticPreview";
import { projectsRouter } from "./projects";

const project = { id: "mock-build-project", userId: 1, name: "Mock studio", description: "A test-only project used to verify Lakay's mock generation workflow.", status: "ready" as const, generatedPlan: null, createdAt: new Date(), updatedAt: new Date() };

function context(): TrpcContext {
  return { user: { id: 1, openId: "mock-user", name: "Mock User", email: "mock@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterEach(() => vi.clearAllMocks());

describe("Lakay test-only mock build workflow", () => {
  it("creates persisted static files, a restorable version, project chat entries, and a refreshed sandbox document without an LLM", async () => {
    const messages: Array<{ projectId: string; userId: number; role: "user" | "assistant"; content: string }> = [];
    let persistedFiles: Array<{ path: string; language: "html" | "css" | "javascript"; content: string }> = [];
    let version: { id: string; projectId: string; userId: number; instruction: string; summary: string; origin: "generate"; files: typeof persistedFiles; createdAt: Date } | null = null;
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.createProjectMessage).mockImplementation(async message => { messages.push(message as never); return {} as never; });
    vi.mocked(db.replaceBuilderFilesForUser).mockImplementation(async input => {
      persistedFiles = input.files as never;
      version = { id: "mock-version", projectId: input.projectId, userId: input.userId, instruction: input.instruction, summary: input.summary, origin: "generate", files: persistedFiles, createdAt: new Date() };
      return { versionId: version.id, files: persistedFiles } as never;
    });
    vi.mocked(db.listBuilderFilesForUser).mockImplementation(async () => persistedFiles as never);
    vi.mocked(db.listBuilderVersionsForUser).mockImplementation(async () => version ? [version] as never : [] as never);
    vi.mocked(db.listProjectMessagesForUser).mockImplementation(async () => messages.map((message, index) => ({ id: `message-${index}`, ...message, createdAt: new Date() })) as never);

    const builder = builderRouter.createCaller(context());
    const projects = projectsRouter.createCaller(context());
    await expect(builder.generateMock({ projectId: project.id, instruction: "Create a blue landing page for testing" })).resolves.toMatchObject({ versionId: "mock-version" });

    const refreshedBuild = await builder.get({ projectId: project.id });
    const refreshedProject = await projects.get({ projectId: project.id });
    const preview = makePreviewDocument(refreshedBuild.files);

    expect(refreshedBuild.files).toHaveLength(6);
    expect(refreshedBuild.versions).toHaveLength(1);
    expect(refreshedBuild.versions[0]).toMatchObject({ id: "mock-version", origin: "generate" });
    expect(refreshedProject.messages.map(message => message.content)).toEqual(expect.arrayContaining([expect.stringContaining("[Test mode]"), expect.stringContaining("Test-mode build completed")]));
    expect(preview).toContain("Test-mode build");
    expect(preview).toContain("#2563eb");
  });
});
