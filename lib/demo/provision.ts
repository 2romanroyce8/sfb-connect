import type { SupabaseClient } from "@supabase/supabase-js";
import { appendCreditTransaction } from "@/lib/billing/credits";
import { sendEmail, demoWelcomeEmail } from "@/lib/email/resend";
import { CAPABILITY_KEYS, TRIAL_TIER } from "@/lib/agentProgram/config";
import { slugify } from "./build";
import { issueCode } from "./verification";

// ============================================================
// DEMO PROVISIONING
// createDemoAccount: account (password chosen on the review screen — Roman 2026-10-11 20:31 ET) + business row with the real
// profile + capabilities + verification code. Nothing is granted yet.
// activateDemo (after the code): verified → 5-day clock + 128 credits.
// ============================================================

export type DemoProfile = {
  businessName: string; contactName: string; website: string; domain: string;
  category: string | null; nicheTags: string[]; city: string | null; state: string | null; phone: string;
  services: string[]; offerLine: string; socials: Record<string, string>; logoUrl: string | null; toneNotes: string[];
};

export class DemoError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const US_STATE = /^[A-Z]{2}$/;

/** Validates the review-screen payload. Required: business name, your name, phone, offer line. */
export function parseDemoProfile(b: Record<string, unknown>): { profile: DemoProfile } | { error: string } {
  const businessName = clean(b.businessName, 120); const contactName = clean(b.contactName, 80); const phone = clean(b.phone, 32); const offerLine = clean(b.offerLine, 180);
  const website = clean(b.website, 300); const domain = clean(b.domain, 200).toLowerCase();
  if (businessName.length < 2) return { error: "Enter your business name." };
  if (contactName.length < 2) return { error: "Enter your name — it signs the emails." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a phone number with at least 10 digits." };
  if (offerLine.length < 15) return { error: "Write your one-line offer (at least 15 characters) — every intro uses it." };
  if (!/^https?:\/\//.test(website) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "Website is missing." };
  const services = Array.from(new Set((Array.isArray(b.services) ? b.services : []).map((s) => clean(s, 60)).filter((s) => s.length >= 2))).slice(0, 20);
  const socialsIn = (b.socials && typeof b.socials === "object" ? b.socials : {}) as Record<string, unknown>;
  const socials: Record<string, string> = {};
  for (const [k, v] of Object.entries(socialsIn)) { const u = clean(v, 300); if (/^[a-z]{1,16}$/.test(k) && /^https?:\/\//.test(u)) socials[k] = u; }
  const state = clean(b.state, 2).toUpperCase();
  const logoUrl = clean(b.logoUrl, 500); const toneNotes = (Array.isArray(b.toneNotes) ? b.toneNotes : []).map((s) => clean(s, 80)).filter(Boolean).slice(0, 6);
  const nicheTags = Array.from(new Set((Array.isArray(b.nicheTags) ? b.nicheTags : []).map((t) => clean(t, 40).toLowerCase()).filter(Boolean))).slice(0, 4);
  return { profile: { businessName, contactName, website, domain, category: clean(b.category, 80) || null, nicheTags, city: clean(b.city, 80) || null, state: US_STATE.test(state) ? state : null, phone, services, offerLine, socials, logoUrl: /^https?:\/\//.test(logoUrl) ? logoUrl : null, toneNotes } };
}

async function uniqueSlug(service: SupabaseClient, name: string): Promise<string> {
  const base = slugify(name);
  for (let i = 0; i < 20; i++) {
    const s = i === 0 ? base : `${base}-${i + 1}`;
    const { data } = await service.from("businesses").select("id").eq("slug", s).maybeSingle();
    if (!data) return s;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Account + business + capabilities + first code. Returns ids for the signed pending cookie. */
export async function createDemoAccount(service: SupabaseClient, input: { email: string; password: string; buildId: string | null; profile: DemoProfile }): Promise<{ userId: string; businessId: string; reusedAccount: boolean }> {
  const email = input.email.trim().toLowerCase();
  const { data: existing } = await service.from("users").select("id").eq("email", email).maybeSingle();
  let userId = existing?.id as string | undefined; let reused = false;
  if (userId) {
    const { data: biz } = await service.from("businesses").select("id, plan_key, email_verified_at").eq("owner_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (biz?.plan_key && (biz.email_verified_at || biz.plan_key !== "trial")) throw new DemoError("exists", "This email already has an SFB Connect account. Sign in instead.", 409);
    // An abandoned, unverified demo: reuse the account, replace the unverified business.
    if (biz?.id) await service.from("businesses").delete().eq("id", biz.id).is("email_verified_at", null);
    const { error: pErr } = await service.auth.admin.updateUserById(userId, { password: input.password, user_metadata: { full_name: input.profile.contactName } });
    if (pErr) throw new DemoError("account", pErr.message, 500);
    reused = true;
  } else {
    const { data: created, error } = await service.auth.admin.createUser({ email, password: input.password, email_confirm: false, user_metadata: { full_name: input.profile.contactName } });
    if (error || !created.user) throw new DemoError("account", error?.message || "Could not create the account.", 500);
    userId = created.user.id;
  }
  await service.from("users").update({ full_name: input.profile.contactName }).eq("id", userId);
  const p = input.profile;
  const slug = await uniqueSlug(service, p.businessName);
  const { data: biz, error: bErr } = await service.from("businesses").insert({
    owner_id: userId, legal_name: p.businessName, website: p.website, primary_category: p.category, niche_tags: p.nicheTags, city: p.city, state: p.state, phone: p.phone, slug,
    brand_logo_url: p.logoUrl, tone_notes: p.toneNotes.join(" · ") || null, services: p.services, social_links: p.socials, outbound_offer_line: p.offerLine,
    plan_key: "trial", is_sandbox: false, stock_profile_key: null, monthly_credit_allotment: TRIAL_TIER.credits, trial_expires_at: null, email_verified_at: null,
    demo_build_id: input.buildId, analyzer_scan_domain: p.domain,
  }).select("id").single();
  if (bErr || !biz) throw new DemoError("business", bErr?.message || "Could not create the business.", 500);
  // Outbound is the capability the demo sells; the other seven are visible, ready toggles.
  await service.from("business_capabilities").insert(CAPABILITY_KEYS.map((k) => ({ business_id: biz.id, capability_key: k, enabled: k === "outbound_gtm" })));
  if (input.buildId) await service.from("demo_builds").update({ status: "claimed", business_id: biz.id }).eq("id", input.buildId);
  await service.from("billing_audit_log").insert({ business_id: biz.id, action: "demo_created", detail: { build_id: input.buildId, domain: p.domain, slug, reused_account: reused } });
  const code = await issueCode(service, userId, email, p.businessName);
  if (!code.ok) throw new DemoError("code_send", "We couldn't send the verification email just now. Try again in a minute.", 502);
  return { userId, businessId: biz.id as string, reusedAccount: reused };
}

/** Verified: the agent may act. Starts the 5-day clock, grants the 128 credits, confirms the auth email, sends the welcome. Idempotent. */
export async function activateDemo(service: SupabaseClient, input: { userId: string; businessId: string; email: string }): Promise<{ expiresAt: string; alreadyActive: boolean }> {
  const { data: biz } = await service.from("businesses").select("id, legal_name, email_verified_at, trial_expires_at, owner_id").eq("id", input.businessId).eq("owner_id", input.userId).maybeSingle();
  if (!biz) throw new DemoError("not_found", "Demo not found.", 404);
  if (biz.email_verified_at && biz.trial_expires_at) return { expiresAt: biz.trial_expires_at, alreadyActive: true };
  const now = new Date(); const expires = new Date(now.getTime() + TRIAL_TIER.trialDays * 86400000).toISOString();
  await service.from("businesses").update({ email_verified_at: now.toISOString(), trial_expires_at: expires, credits_cycle_started_at: now.toISOString(), work_paused_reason: null, updated_at: now.toISOString() }).eq("id", biz.id);
  await service.auth.admin.updateUserById(input.userId, { email_confirm: true }).catch(() => undefined);
  await appendCreditTransaction(service, { businessId: biz.id, type: "PROMOTIONAL", amount: TRIAL_TIER.credits, source: "trial_grant", description: `Trial credits (${TRIAL_TIER.credits}) — expire ${new Date(expires).toLocaleDateString("en-US")}`, idempotencyKey: `trial:${biz.id}` });
  await service.from("billing_audit_log").insert({ business_id: biz.id, action: "trial_started", detail: { provisioned_via: "demo_verified", expires_at: expires } });
  const { data: u } = await service.from("users").select("full_name").eq("id", input.userId).maybeSingle();
  void sendEmail({ to: input.email, ...demoWelcomeEmail({ name: (u?.full_name as string) || "there", businessName: biz.legal_name, credits: TRIAL_TIER.credits, days: TRIAL_TIER.trialDays }) });
  return { expiresAt: expires, alreadyActive: false };
}
