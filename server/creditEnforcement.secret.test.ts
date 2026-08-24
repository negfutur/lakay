import { describe, expect, it } from "vitest";
import { creditEnforcementEnabled, getCreditUsageCost } from "./creditConfig";

describe("Lakay active credit-enforcement configuration", () => {
  it("enables server-side preflight credit enforcement with the requested operation costs", () => {
    expect(creditEnforcementEnabled).toBe(true);
    expect(getCreditUsageCost("project_plan")).toBe(10);
    expect(getCreditUsageCost("builder_generate")).toBe(1);
    expect(getCreditUsageCost("builder_autofix")).toBe(1);
  });
});
