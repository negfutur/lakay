import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./AppBuilder.tsx", import.meta.url), "utf8");

describe("Lakay Builder Chat history hydration", () => {
  it("keeps the persisted message sequence supplied by the server instead of reversing or sorting it in the client", () => {
    expect(source).toContain("const existing = project.messages.map(message => ({ role: message.role, content: message.content })) as Message[];");
    expect(source).toContain("setChatMessages(existing.length ? existing");
    expect(source).not.toContain("project.messages.reverse()");
  });
});
