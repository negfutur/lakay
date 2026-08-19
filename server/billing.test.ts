import { describe, expect, it } from "vitest";
import { billingRouter } from "./billing";
import type { TrpcContext } from "./_core/context";

function contextForUser(): TrpcContext {
  return {
    user: { id: 1, openId: "billing-user", name: "Billing User", email: "billing@example.com", loginMethod: "manus", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: { origin: "https://lakay.example" } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Lakay billing configuration", () => {
  it("does not create checkout sessions when no real Stripe credit package has been configured", async () => {
    const caller = billingRouter.createCaller(contextForUser());
    await expect(caller.createCheckout({ packageId: "unconfigured" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
