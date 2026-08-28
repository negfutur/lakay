import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Lakay AI request reliability contract", () => {
  it("uses a 45-second abortable deadline on Gemini, OpenRouter, and the final provider fallback", () => {
    const gemini = source("server/gemini.ts");
    const openRouter = source("server/openRouter.ts");
    const forge = source("server/_core/llm.ts");
    expect(gemini).toContain("const GEMINI_REQUEST_TIMEOUT_MS = 45_000");
    expect(gemini).toContain("signal: controller.signal");
    expect(gemini).toContain("if (providerError.status === 504) throw providerError;");
    expect(openRouter).toContain("const REQUEST_TIMEOUT_MS = 45_000");
    expect(openRouter).toContain("error instanceof OpenRouterProviderError && error.status === 504");
    expect(forge).toContain("const LLM_REQUEST_TIMEOUT_MS = 45_000");
    expect(forge).toContain("Le fournisseur IA n’a pas répondu dans le délai prévu.");
  });

  it("routes initial durable builds through Gemini Pro and preserves controlled fallback after a timeout", () => {
    const tasks = source("server/backgroundTasks.ts");
    const providerCore = source("server/aiProviderCore.ts");
    expect(tasks).toContain('createGeminiBackgroundInteraction(request, input.files.length ? "followup" : "pro")');
    expect(tasks).toContain("shouldRescueGeminiBackgroundSubmission");
    expect(providerCore).toContain("isRetryableStatus(error.status)");
    expect(providerCore).toContain('return withProvider(await invokeOpenRouter');
  });

  it("locks protected concurrent Builder work and disables the Chat composer during active work", () => {
    const builder = source("server/builder.ts");
    const db = source("server/db.ts");
    const page = source("client/src/pages/AppBuilder.tsx");
    const chat = source("client/src/components/AIChatBox.tsx");
    expect(builder).toContain("acquireUserAiRequestLock(ctx.user.id, input.requestId)");
    expect(builder).toContain("getActiveBackgroundTaskForUser(ctx.user.id)");
    expect(db).toContain("export async function getActiveBackgroundTaskForUser");
    expect(page).toContain("const activeConversationRef = useRef(false)");
    expect(page).toContain("activeConversationRef.current = true");
    expect(chat).toContain("disabled={(!input.trim() && !attachment) || isLoading}");
  });
});
