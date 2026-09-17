// Thin, lazily-initialized Stripe client wrapper. Every real Stripe call in
// this codebase goes through this file -- never construct a `new Stripe()`
// elsewhere. Throws a clear, honest error if the key isn't configured yet
// (same pattern as lib/crm/googleCalendar.ts's requireEnv) rather than
// silently no-op'ing and letting a caller think a checkout succeeded.
import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeNotConfiguredError();
  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia" });
  return client;
}

export class StripeNotConfiguredError extends Error {
  constructor() {
    super("Stripe isn't configured yet. Add STRIPE_SECRET_KEY (and STRIPE_WEBHOOK_SECRET) to the environment.");
    this.name = "StripeNotConfiguredError";
  }
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new StripeNotConfiguredError();
  return secret;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
