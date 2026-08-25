import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({
  getProjectForUser: vi.fn(),
  listBuilderFilesForUser: vi.fn(),
  listBuilderVersionsForUser: vi.fn(),
  getRunnerProfileForUser: vi.fn(),
  listRunnerJobsForUser: vi.fn(),
  listRunnerJobLogsForUser: vi.fn(),
  getMobileBrandingForUser: vi.fn(),
  replaceBuilderFilesForUser: vi.fn(),
  recordAiGenerationUsage: vi.fn(),
  consumeCreditForUser: vi.fn(),
  refundCreditForUser: vi.fn(),
  createProjectMessage: vi.fn(),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn(), LlmProviderQuotaError: class LlmProviderQuotaError extends Error {} }));
vi.mock("./projectPlanning", () => ({ invokeLakayWithFallback: vi.fn() }));

import * as db from "./db";
import { invokeLakayWithFallback } from "./projectPlanning";
import { builderRouter } from "./builder";

const project = {
  id: "auto-fix-route-project",
  userId: 1,
  name: "Route repair",
  description: "A static project used to validate Lakay's protected auto-fix route.",
  status: "ready" as const,
  generatedPlan: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const existingFiles = [
  { path: "index.html", language: "html", content: "<!doctype html><html><body><main id='app'></main></body></html>" },
  { path: "styles.css", language: "css", content: "body { margin: 0; }" },
  { path: "data.js", language: "javascript", content: "window.LakayData = {};" },
  { path: "state.js", language: "javascript", content: "window.LakayState = {};" },
  { path: "components.js", language: "javascript", content: "window.render = () => {};" },
  { path: "app.js", language: "javascript", content: "window.render(undefined);" },
];

const repairedFiles = [
  ...existingFiles.slice(0, 3),
  { path: "state.js", language: "javascript", content: "window.LakayState = { activeTab: 'home' };" },
  existingFiles[4],
  { path: "app.js", language: "javascript", content: "window.render(window.LakayState.activeTab);" },
];

function context(): TrpcContext {
  return {
    user: { id: 1, openId: "repair-user", name: "Repair User", email: "repair@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

beforeEach(() => {
  vi.mocked(db.consumeCreditForUser).mockResolvedValue({ consumed: true, insufficient: false, chargedCredits: 1, balanceAfter: 20 } as never);
});

afterEach(() => vi.clearAllMocks());

describe("Lakay protected auto-fix route integration", () => {
  it("uses the real generation pipeline, persists a repaired version, and exposes the repaired files on refresh", async () => {
    vi.mocked(db.getProjectForUser).mockResolvedValue(project as never);
    vi.mocked(db.listBuilderFilesForUser).mockResolvedValueOnce(existingFiles as never).mockResolvedValueOnce(repairedFiles as never);
    vi.mocked(db.listBuilderVersionsForUser).mockResolvedValue([] as never);
    vi.mocked(db.replaceBuilderFilesForUser).mockResolvedValue({ versionId: "repaired-version", files: repairedFiles } as never);
    vi.mocked(invokeLakayWithFallback).mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ summary: "Restored the active tab state.", files: repairedFiles }) } }] } as never);

    const caller = builderRouter.createCaller(context());
    const result = await caller.autoFix({ projectId: project.id, issues: ["ReferenceError: activeTab is not defined"], requestId: "44444444-4444-4444-8444-444444444444" });
    const refreshed = await caller.get({ projectId: project.id });

    expect(invokeLakayWithFallback).toHaveBeenCalled();
    expect(vi.mocked(invokeLakayWithFallback).mock.calls[0]?.[0].messages[1]?.content).toContain("ReferenceError: activeTab is not defined");
    expect(db.replaceBuilderFilesForUser).toHaveBeenCalledWith(expect.objectContaining({ userId: 1, projectId: project.id, origin: "generate", files: repairedFiles }));
    expect(result).toMatchObject({ versionId: "repaired-version", files: repairedFiles });
    expect(refreshed.files).toEqual(repairedFiles);
  });
});
