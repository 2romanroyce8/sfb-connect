import { sendEmail, trialWelcomeEmail } from "@/lib/email/resend";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { appendCreditTransaction } from "@/lib/billing/credits";
import { rateLimit } from "@/lib/agent/store";
import { CAPABILITY_KEYS, TIERS, stockProfile, type CapabilityKey } from "@/lib/agentProgram/config";
import { readCache } from "@/lib/analyzer/run";
import { firstThreeTasks } from "@/lib/analyzer/narrate";
import { fetchAgentModules } from "@/lib/agentProgram/modules";
import { createTask } from "@/lib/agent/tasks/queue";
export const dynamic = "force-dynamic";

// Trial signup: account + sandboxed business on a stock profile + 128 credits
// + 3 capabilities to watch + 3-day expiry (TIERS.trialDays). No Stripe, no real integrations,
// no real sends -- everything the trial agent does is on stock data.
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`trial:${ip}:1d`, 5, 86400);
  if (!rl.allowed) return NextResponse.json({ error: "Too many trials from this network today." }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { name?: string; email?: string; password?: string; stockProfile?: string; capabilities?: string[]; scanDomain?: string };
  const name = (b.name ?? "").trim().slice(0, 80);
  const email = (b.email ?? "").trim().toLowerCase();
  const password = b.password ?? "";
  const profile = stockProfile(b.stockProfile);
  const caps = Array.from(new Set((b.capabilities ?? []).filter((c): c is CapabilityKey => (CAPABILITY_KEYS as string[]).includes(c))));
  const trial = TIERS[0];
  const scanDomain = typeof b.scanDomain === "string" && /^[a-z0-9.-]{3,200}$/i.test(b.scanDomain) ? b.scanDomain.toLowerCase() : null;
  if (name.length < 2) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  if (!profile) return NextResponse.json({ error: "Pick a sample business." }, { status: 400 });
  if (caps.length !== trial.capabilityLimit) return NextResponse.json({ error: `Pick exactly ${trial.capabilityLimit} capabilities to watch.` }, { status: 400 });

  const service = createSupabaseServiceClient();
  const { data: existing } = await service.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "An account with this email already exists. Sign in instead.", signIn: true }, { status: 409 });

  const { data: created, error: cErr } = await service.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (cErr || !created.user) return NextResponse.json({ error: cErr?.message || "Could not create the account." }, { status: 500 });
  const ownerId = created.user.id;
  const now = new Date();
  const expires = new Date(now.getTime() + trial.trialDays! * 86400000).toISOString();
  await service.from("users").update({ full_name: name }).eq("id", ownerId);
  const { data: biz, error: bErr } = await service.from("businesses").insert({ owner_id: ownerId, legal_name: `${profile.name} (demo)`, website: profile.website, primary_category: profile.category, plan_key: "trial", is_sandbox: true, stock_profile_key: profile.key, trial_expires_at: expires, monthly_credit_allotment: trial.credits, credits_cycle_started_at: now.toISOString() }).select("id").single();
  if (bErr || !biz) return NextResponse.json({ error: bErr?.message || "Could not create the demo business." }, { status: 500 });
  await service.from("business_capabilities").insert(CAPABILITY_KEYS.map((k) => ({ business_id: biz.id, capability_key: k, enabled: caps.includes(k) })));
  await appendCreditTransaction(service, { businessId: biz.id, type: "PROMOTIONAL", amount: trial.credits, source: "trial_grant", description: `Trial credits (${trial.credits}) — expire ${new Date(expires).toLocaleDateString("en-US")}`, idempotencyKey: `trial:${biz.id}` });
  await service.from("billing_audit_log").insert({ business_id: biz.id, action: "trial_started", detail: { stock_profile: profile.key, capabilities: caps, expires_at: expires, scan_domain: scanDomain } });
  // Trial tie-in: the "first 3 tasks" mirror the preview's top findings on LIVE capabilities only.
  // The preview promised; the trial shows. Best-effort — a missing scan just means no seeded tasks.
  if (scanDomain) {
    try {
      await service.from("businesses").update({ analyzer_scan_domain: scanDomain }).eq("id", biz.id);
      const [scan, modules] = await Promise.all([readCache(service, scanDomain), fetchAgentModules()]);
      if (scan) {
        for (const t of firstThreeTasks(scan.findings, modules)) {
          await createTask("hyperagent", { title: t.title, owner_agent: "atlas", context: `${t.context}\nTrial business: ${biz.id} (sandbox, stock data — demonstrate on the demo business; no real sends). Preview domain: ${scanDomain}.`, priority: "normal", requires_review: true, reviewer_agent: "hyperagent" });
        }
      }
    } catch (e) { console.error("[trial] first-tasks seed failed:", e instanceof Error ? e.message : e); }
  }
  // Welcome email is best-effort and never blocks the signup.
  void sendEmail({ to: email, ...trialWelcomeEmail({ name: profile.name, credits: trial.credits, days: trial.trialDays!, businessName: `${profile.name} (demo)` }) });
  return NextResponse.json({ ok: true, businessId: biz.id, expiresAt: expires });
}
