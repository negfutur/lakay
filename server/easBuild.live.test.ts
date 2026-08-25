import { describe, expect, it } from "vitest";
import { verifyEasBuildToken } from "./easBuild";

describe("EAS Build live token validation", () => {
  it("authenticates the configured server-only token with Expo", async () => {
    const result = await verifyEasBuildToken();
    expect(result.ok).toBe(true);
    expect(result.account).toBeTruthy();
  }, 20_000);
});
