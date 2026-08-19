import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  replaceBuilderFilesForUser: vi.fn(),
  updateBuilderFileForUser: vi.fn(),
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
  { path: "index.html" as const, language: "html" as const, content: "<main>Launchpad</main>" },
  { path: "styles.css" as const, language: "css" as const, content: "body { color: black; }" },
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

    await expect(caller.generate({ projectId: project.id, instruction: "Make the conversion flow stronger." })).resolves.toMatchObject({ versionId: "version-one" });

    expect(db.getProjectForUser).toHaveBeenCalledWith(1, project.id);
    expect(generateWebsiteFiles).toHaveBeenCalledWith(expect.objectContaining({ project, existingFiles: files }));
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "generate" }));
  });

  it("returns builder files and versions only after confirming ownership", async () => {
    const caller = builderRouter.createCaller(contextFor(1));
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValue(files as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);

    await expect(caller.get({ projectId: project.id })).resolves.toEqual({ files, versions: [] });

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
    vi.mocked(db.updateBuilderFileForUser).mockResolvedValue({ path: "styles.css", content: "body { color: purple; }" } as never);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(version as never);
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "version-restored", files } as never);

    await expect(caller.updateFile({ projectId: project.id, path: "styles.css", content: "body { color: purple; }" })).resolves.toMatchObject({ path: "styles.css" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: version.id })).resolves.toMatchObject({ versionId: "version-restored" });

    expect(db.updateBuilderFileForUser).toHaveBeenCalledWith(1, project.id, "styles.css", "body { color: purple; }");
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(1, project.id, version.id);
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, files, origin: "restore" }));
  });

  it("rejects file edits and version restore when another user has no owned builder record", async () => {
    const caller = builderRouter.createCaller(contextFor(2));
    vi.mocked(db.updateBuilderFileForUser).mockResolvedValue(undefined);
    vi.mocked(db.getBuilderVersionForUser).mockResolvedValue(undefined);

    await expect(caller.updateFile({ projectId: project.id, path: "index.html", content: "<main>Attempt</main>" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.restoreVersion({ projectId: project.id, versionId: "version-one" })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(db.updateBuilderFileForUser).toHaveBeenCalledWith(2, project.id, "index.html", "<main>Attempt</main>");
    expect(db.getBuilderVersionForUser).toHaveBeenCalledWith(2, project.id, "version-one");
  });
});
