import type { Express, Request, Response } from "express";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import { invokeLakayStreamWithFallback } from "./projectPlanning";
import { refundAiCreditsAfterProviderFailure, requireAiCredits } from "./creditUsage";
import { getLlmUserMessage } from "./llmErrors";

function writeEvent(response: Response, event: string, payload: Record<string, unknown>) {
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function forwardOpenAIStream(
  response: globalThis.Response,
  onDelta: (content: string) => void
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The AI response did not include a stream.");

  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  const processEvent = (block: string) => {
    const data = block
      .split("\n")
      .map(line => line.trimEnd())
      .filter(line => line.startsWith("data:"))
      .map(line => line.slice(5).trim())
      .join("\n");
    if (!data) return;
    if (data === "[DONE]") {
      done = true;
      return;
    }
    const payload = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
    };
    const text = payload.choices?.[0]?.delta?.content;
    if (typeof text === "string" && text.length > 0) onDelta(text);
  };

  while (!done) {
    const next = await reader.read();
    if (next.done) break;
    buffer += decoder.decode(next.value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      processEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim() && !done) processEvent(buffer);
}

export function registerProjectStream(app: Express) {
  app.post("/api/projects/:projectId/chat/stream", async (req: Request, res: Response) => {
    const projectId = req.params.projectId;
    const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
    const requestId = typeof req.body?.requestId === "string" ? req.body.requestId : "";

    if (!projectId || !content || content.length > 5000 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
      res.status(400).json({ error: "A valid chat message is required." });
      return;
    }

    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    const project = await db.getProjectForUser(user.id, projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    let charge: Awaited<ReturnType<typeof requireAiCredits>>;
    try {
      charge = await requireAiCredits(user.id, "project_chat", requestId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lakay credits could not be verified.";
      res.status(402).json({ error: message });
      return;
    }

    const history = await db.listProjectMessagesForUser(user.id, projectId);
    await db.createProjectMessage({ projectId, userId: user.id, role: "user", content });

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const controller = new AbortController();
    let finished = false;
    const onResponseClose = () => {
      if (!finished) controller.abort();
    };
    res.on("close", onResponseClose);

    let assistantContent = "";
    try {
      const response = await invokeLakayStreamWithFallback({
        signal: controller.signal,
        messages: [
          {
            role: "system",
            content: `You are Lakay's product-planning copilot. Help the user refine their app idea with concrete, thoughtful guidance. Their current project plan is: ${JSON.stringify(project.generatedPlan)}. Use concise Markdown when it improves clarity.`,
          },
          ...history.slice(-18).map(message => ({ role: message.role, content: message.content })),
          { role: "user", content },
        ],
      });

      await forwardOpenAIStream(response, delta => {
        assistantContent += delta;
        writeEvent(res, "delta", { content: delta });
      });

      if (assistantContent.trim()) {
        const message = await db.createProjectMessage({
          projectId,
          userId: user.id,
          role: "assistant",
          content: assistantContent,
        });
        writeEvent(res, "complete", { messageId: message.id });
      } else {
        writeEvent(res, "error", { message: "The AI returned an empty response. Please try again." });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        await refundAiCreditsAfterProviderFailure(user.id, "project_chat", charge);
        console.error("[Lakay stream]", error);
        writeEvent(res, "error", { message: getLlmUserMessage(error) || "Lakay could not complete that response. Please try again." });
      }
    } finally {
      finished = true;
      res.off("close", onResponseClose);
      res.end();
    }
  });
}
