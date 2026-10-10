// Alias: the canonical Stripe webhook lives at /api/webhooks/stripe. This path
// was given to the owner in setup instructions, so both URLs accept events.
export { POST } from "@/app/api/webhooks/stripe/route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
