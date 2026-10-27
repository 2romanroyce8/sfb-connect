import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";
import { appOrigin } from "@/lib/agent/auth";
import { rateLimit } from "@/lib/agent/store";
import { billingEnabled, PLATFORM_PRICE_CENTS } from "@/lib/agency/billing";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Agency billing actions: platform checkout ($49/mo), billing portal, Stripe Connect onboarding. Owner/admin only. OFF unless AGENCY_BILLING_ENABLED=1.
// The agency always comes from the signed-in membership. Nothing here creates a charge by itself: it only creates a Stripe-hosted page the owner must complete.
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
export async function POST(req: NextRequest) {
  if (!billingEnabled()) return fail("Billing isn't switched on yet. Workspaces are free for now.", 503);
  const r = await getAgencyContext(); if (r.status !== "ok") return fail("Not signed in to an agency.", 401);
  if (!["owner", "admin"].includes(r.ctx.role)) return fail("Only an owner or admin can manage billing.", 403);
  if (!(await rateLimit(`agency-billing:${r.ctx.userId}:1h`, 20, 3600)).allowed) return fail("Too many attempts. Try again later.", 429);
  const b = (await req.json().catch(() => ({}))) as { action?: string };
  const svc = createSupabaseServiceClient(); const origin = appOrigin(req); const ag = r.ctx.agencyId;
  const { data: row } = await svc.from("agency_billing").select("*").eq("agency_id", ag).maybeSingle();
  try {
    const stripe = getStripeClient();
    if (b.action === "checkout") {
      if (row?.subscription_status && ["active", "trialing", "past_due"].includes(row.subscription_status as string)) return fail("This agency already has a subscription. Use Manage billing.", 409);
      const { data: u } = await createSupabaseServerClient().auth.getUser();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription", client_reference_id: ag, ...(row?.stripe_customer_id ? { customer: row.stripe_customer_id as string } : { customer_email: u.user?.email ?? undefined }),
        line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: PLATFORM_PRICE_CENTS, recurring: { interval: "month" }, product_data: { name: "SFB Connect agency platform", description: "Agency workspace, demo builder, CRM and client tools" } } }],
        metadata: { kind: "agency_platform", agency_id: ag }, subscription_data: { metadata: { kind: "agency_platform", agency_id: ag } },
        success_url: `${origin}/app/billing?checkout=success`, cancel_url: `${origin}/app/billing?checkout=canceled`, billing_address_collection: "auto",
      });
      return NextResponse.json({ url: session.url });
    }
    if (b.action === "portal") {
      if (!row?.stripe_customer_id) return fail("There's no subscription to manage yet.", 404);
      const p = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id as string, return_url: `${origin}/app/billing` });
      return NextResponse.json({ url: p.url });
    }
    if (b.action === "connect") {
      let acct = row?.connect_account_id as string | undefined;
      if (!acct) {
        const a = await stripe.accounts.create({ controller: { stripe_dashboard: { type: "express" }, fees: { payer: "application" }, losses: { payments: "application" }, requirement_collection: "stripe" }, capabilities: { card_payments: { requested: true }, transfers: { requested: true } }, metadata: { agency_id: ag } });
        acct = a.id; await svc.from("agency_billing").upsert({ agency_id: ag, connect_account_id: acct, updated_at: new Date().toISOString() });
      }
      const link = await stripe.accountLinks.create({ account: acct, type: "account_onboarding", refresh_url: `${origin}/app/billing?connect=refresh`, return_url: `${origin}/app/billing?connect=return` });
      return NextResponse.json({ url: link.url });
    }
    return fail("Unknown action.");
  } catch (e) {
    if (e instanceof StripeNotConfiguredError) return fail("Payments aren't configured yet.", 503);
    const msg = e instanceof Error ? e.message : "";
    console.error("[agency-billing]", msg);
    if (/connect/i.test(msg) && /(signed up|enable|not enabled|platform)/i.test(msg)) return fail("Stripe Connect isn't fully enabled on the platform account yet.", 503);
    return fail("Stripe couldn't complete that. Please try again.", 502);
  }
}
