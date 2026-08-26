import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const authGate = readFileSync(new URL("./LocalAuthGate.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("local authentication entry screen", () => {
  it("offers secure e-mail/password registration and login alongside Manus", () => {
    expect(authGate).toContain("trpc.localAuth.login.useMutation");
    expect(authGate).toContain("trpc.localAuth.register.useMutation");
    expect(authGate).toContain("Continuer avec Manus");
    expect(authGate).toContain("minLength={10}");
  });

  it("is reachable through the dedicated public login route", () => {
    expect(routes).toContain('path="/login" component={LocalAuthGate}');
  });
});
