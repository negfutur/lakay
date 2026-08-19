import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured for this environment.");
  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}
