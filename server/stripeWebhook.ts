import express from "express";
import type { Express, Request, Response } from "express";
import { getCreditPackage } from "./creditConfig";
import * as db from "./db";
import { getStripeClient } from "./stripeService";

export function registerStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (typeof signature !== "string" || !secret) {
      res.status(400).json({ error: "Stripe webhook configuration is unavailable." });
      return;
    }

    let event;
    try {
      event = getStripeClient().webhooks.constructEvent(req.body, signature, secret);
    } catch {
      res.status(400).json({ error: "Invalid Stripe webhook signature." });
      return;
    }

    if (event.id.startsWith("evt_test_")) {
      console.log("[Webhook] Test event detected, returning verification response");
      res.json({ verified: true });
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = Number(session.metadata?.user_id || session.client_reference_id);
      const creditPackage = getCreditPackage(session.metadata?.package_id || "");
      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!Number.isSafeInteger(userId) || userId < 1 || !creditPackage || session.payment_status !== "paid") {
        res.status(400).json({ error: "Checkout metadata or payment status is invalid." });
        return;
      }
      try {
        const result = await db.creditCheckoutForUser({
          userId,
          credits: creditPackage.credits,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId || null,
          stripeEventId: event.id,
        });
        console.info("[Stripe] Checkout processed", { eventId: event.id, userId, credited: result.credited });
      } catch (error) {
        console.error("[Stripe] Checkout processing failed", { eventId: event.id, error });
        res.status(500).json({ error: "Credit fulfillment failed." });
        return;
      }
    }

    res.json({ received: true });
  });
}
