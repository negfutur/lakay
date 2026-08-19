import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  replaceBuilderFilesForUser: vi.fn(),
  updateBuilderFileAndSnapshotForUser: vi.fn(),
  getBuilderVersionForUser: vi.fn(),
}));

vi.mock("./builderGeneration", () => ({ generateWebsiteFiles: vi.fn() }));

import * as db from "./db";
import { builderRouter } from "./builder";
import { generateWebsiteFiles } from "./builderGeneration";

const project = {
  id: "project-builder",
  userId: 1,
  name: "Launchpad",
  description: "A sufficiently detailed concept for a polished launch site.",
  status: "ready",
  generatedPlan: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const files = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><body><main>Launchpad</main></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "body { color: black; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.LakayComponents = {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "console.log('ready')" },
];

function contextFor(userId: number): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "Builder", email: "builder@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => vi.clearAllMocks());

describe("Lakay builder router", () => {
  it("generates a versioned website build only for the authenticated project owner", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(generateWebsiteFiles).mockResolvedValue({ summary: "A launch page", files });
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-one", files } as never);

    await expect(caller.generate({ projectId: project.id, instruction: "Make the conversion flow stronger.", requestId: "11111111-1111-4111-8111-111111111111" })).resolves.toMatchObject({ versionId: "version-one" });

    expect(db.getProjectForUser).toHaveBeenCalledWith(1, project.id);
    expect(generateWebsiteFiles).toHaveBeenCalledWith(expect.objectContaining({ project, existingFiles: files }));
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "generate" }));
  });

  it("rebuilds an owned static project through the AI auto-fix procedure", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(generateWebsiteFiles).mockResolvedValue({ summary: "Repaired the interaction.", files });
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-fixed", files } as never);

    await expect(caller.autoFix({ projectId: project.id, issues: ["ReferenceError: activeTab is not defined"], requestId: "22222222-2222-4222-8222-222222222222" })).resolves.toMatchObject({ versionId: "version-fixed" });

    expect(generateWebsiteFiles).toHaveBeenCalledWith(expect.objectContaining({ project, existingFiles: files }));
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ summary: "Auto-fix: Repaired the interaction.", origin: "generate" }));
  });

  it("returns builder files and versions only after confirming ownership", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);

    await expect(caller.get({ projectId: project.id })).resolves.toMatchObject({ files, versions: [], validation: { valid: true, issues: [] }, projectContext: { recentMemory: [] } });

    expect(db.listBuilderFilesForUser).toHaveBeenCalledWith(1, project.id);
    expect(db.listBuilderVersionsForUser).toHaveBeenCalledWith(1, project.id);
  });

  it("saves direct file edits and restores an owned version into a new saved build", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    const version = {
      id: "version-one",
      projectId: project.id,
      userId: 1,
      instruction: "Initial build",
      origin: "generate" as const,
      files,
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
    };
    vi.mocked(db.updateBuilderFileAndSnapshotForUser).mockResolvedValue({ path: "styles.css", content: "body { color: purple; }", versionId: "version-edit" } as never);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(version as never);
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-restored", files } as never);

    await expect(caller.updateFile({ projectId: project.id, path: "styles.css", content: "body { color: purple; }" })).resolves.toMatchObject({ path: "styles.css" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: version.id })).resolves.toMatchObject({ versionId: "version-restored" });

    expect(db.updateBuilderFileAndSnapshotForUser).toHaveBeenCalledWith(1, project.id, "styles.css", "body { color: purple; }");
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(1, project.id, version.id);
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "restore" }));
  });

  it("rejects file edits and version restore when another user has no owned builder record", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue([] as never);
    vi.mocked(db.updateBuilderFileAndSnapshotForUser).mockResolvedValue(undefined);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(undefined);

    await expect(caller.updateFile({ projectId: project.id, path: "index.html", content: "<main>Attempt</main>" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: "version-one" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.updateBuilderFileAndSnapshotForUser).not.toHaveBeenCalled();
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(2, project.id, "version-one");
  });
});
