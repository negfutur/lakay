import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("./SetLocalPasswordPage.tsx", import.meta.url), "utf8");

describe("existing-account local password setup", () => {
  it("uses protected credential status and current-user password setup only", () => {
    expect(page).toContain("trpc.localAuth.credentialStatus.useQuery");
    expect(page).toContain("trpc.localAuth.setPasswordForCurrentUser.useMutation");
    expect(page).toContain("redirectPath: \"/settings/password\"");
    expect(page).toContain("Au moins 10 caractères");
  });
});
