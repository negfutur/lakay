import { afterEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  updateBuilderFileAndSnapshotForUser: vi.fn(),
}));

import * as db from "./db";
import { builderRouter } from "./builder";
import { makePreviewDocument } from "../client/src/lib/staticPreview";

const project = { id: "preview-project", userId: 1, name: "Preview test", description: "A project used to prove Lakay reloads its static sandbox from persisted files.", status: "ready" as const, generatedPlan: null, createdAt: new Date(), updatedAt: new Date() };
const initialFiles = [
  { path: "index.html" as const, language: "html" as const, content: "<!doctype html><html><head></head><body><button>Book</button></body></html>" },
  { path: "styles.css" as const, language: "css" as const, content: "button { background: black; }" },
  { path: "data.js" as const, language: "javascript" as const, content: "window.LakayData = {};" },
  { path: "state.js" as const, language: "javascript" as const, content: "window.LakayState = {};" },
  { path: "components.js" as const, language: "javascript" as const, content: "window.render = () => {};" },
  { path: "app.js" as const, language: "javascript" as const, content: "window.render();" },
];
const refreshedFiles = initialFiles.map(file => file.path === "styles.css" ? { ...file, content: "button { background: blue; }" } : file);

function context(): TrpcContext {
  return { user: { id: 1, openId: "preview-user", name: "Preview", email: "preview@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

afterEach(() => vi.clearAllMocks());

describe("Lakay persisted builder update to sandbox preview refresh", () => {
  it("refetches a saved file edit and produces a changed isolated preview document", async () => {
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValueOnce(initialFiles as never).mockResolvedValueOnce(refreshedFiles as never);
    vi.mocked(db.updateBuilderFileAndSnapshotForUser).mockResolvedValue({ path: "styles.css", content: "button { background: blue; }", versionId: "preview-edit" } as never);

    const caller = builderRouter.createCaller(context());
    await caller.updateFile({ projectId: project.id, path: "styles.css", content: "button { background: blue; }" });
    const refreshed = await caller.get({ projectId: project.id });

    expect(db.updateBuilderFileAndSnapshotForUser).toHaveBeenCalledWith(1, project.id, "styles.css", "button { background: blue; }");
    expect(refreshed.files).toEqual(refreshedFiles);
    expect(makePreviewDocument(initialFiles)).toContain("background: black");
    expect(makePreviewDocument(refreshed.files)).toContain("background: blue");
  });
});
