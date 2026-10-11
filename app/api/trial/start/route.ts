import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/agent/store";
import { appOrigin } from "@/lib/agent/auth";
import { getStripeClient, StripeNotConfiguredError } from "@/lib/billing/stripe";
import { parseTrialSetup, startTrialCheckout, createTrialBusiness } from "@/lib/agentProgram/trial";
import { TRIAL_TIER, TRIAL_IS_FREE } from "@/lib/agentProgram/config";
export const dynamic = "force-dynamic";

// Trial signup (free, 5 days — TRIAL_IS_FREE): creates the account (password
// set, email confirmed) and provisions the sandbox business, credits and
// 5-day expiry right away. No card, no Stripe. With a non-zero trialUsd the
// same route instead creates a pending order and hands the browser to Stripe
// Checkout; provisioning then waits for the paid session. Rate-limited per IP.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`trial:${ip}:1d`, 5, 86400);
  if (!rl.allowed) return NextResponse.json({ error: "Too many trials from this network today." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string; stockProfile?: string; capabilities?: string[]; scanDomain?: string };
  const email = (b.email ?? "").trim().toLowerCase();
  const password = b.password ?? "";
  const parsed = parseTrialSetup(b);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  let stripe = null as ReturnType<typeof getStripeClient> | null;
  if (!TRIAL_IS_FREE) {
    try { stripe = getStripeClient(); } catch (e) {
      if (e instanceof StripeNotConfiguredError) return NextResponse.json({ error: "The trial checkout isn't available right now. Please try again shortly." }, { status: 409 });
      throw e;
    }
  }
  const service = createSupabaseServiceClient();
  const { data: existing } = await service.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "An account with this email already exists. Sign in — if your trial checkout wasn't finished, you can finish it from there.", signIn: true }, { status: 409 });

  const { data: created, error: cErr } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: parsed.setup.name } });
  if (cErr || !created.user) return NextResponse.json({ error: cErr?.message || "Could not create the account." }, { status: 500 });
  const ownerId = created.user.id;
  await service.from("users").update({ full_name: parsed.setup.name }).eq("id", ownerId);
  if (TRIAL_IS_FREE || !stripe) {
    try {
      const now = new Date();
      const businessId = await createTrialBusiness(service, { ownerId, email, setup: parsed.setup, paidAt: now, orderId: null, paidCents: 0, stripeEventId: null, via: "free" });
      return NextResponse.json({ ok: true, businessId, expiresAt: new Date(now.getTime() + TRIAL_TIER.trialDays * 86400000).toISOString() });
    } catch (err) {
      await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
      console.error("[trial-start]", err instanceof Error ? err.message : err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "Could not start the trial." }, { status: 500 });
    }
  }
  try {
    const { orderId, checkoutUrl } = await startTrialCheckout(service, stripe, { ownerId, email, setup: parsed.setup, origin: appOrigin(req) });
    await service.from("billing_audit_log").insert({ business_id: null, action: "trial_checkout_started", detail: { order_id: orderId, owner_id: ownerId, amount_cents: TRIAL_TIER.trialUsd * 100, stock_profile: parsed.setup.stock_profile, capabilities: parsed.setup.capabilities, scan_domain: parsed.setup.scan_domain } });
    return NextResponse.json({ ok: true, checkoutUrl, orderId });
  } catch (err) {
    // No checkout → no reason to keep a half-made account; the email stays free to try again.
    await service.auth.admin.deleteUser(ownerId).catch(() => undefined);
    console.error("[trial-start]", err instanceof Error ? err.message : err);
    const se = err as { type?: string; code?: string };
    const hint = se && (se.type || se.code) ? ` [stripe ${se.type ?? ""}${se.code ? ` ${se.code}` : ""}]` : "";
    return NextResponse.json({ error: `Could not start the trial checkout. Please try again.${hint}` }, { status: 500 });
  }
}
