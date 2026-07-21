import Stripe from "stripe";

/**
 * Returns a configured Stripe client, or null when no secret key is set.
 * Null == DEMO MODE: the app simulates a successful top-up so the wallet and
 * prizemoney flows are fully exercisable without real keys.
 */
let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key
    ? new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion })
    : null;
  return cached;
}

export function isDemoMode() {
  return !process.env.STRIPE_SECRET_KEY;
}
