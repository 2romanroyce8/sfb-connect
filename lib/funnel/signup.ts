import type { SupabaseClient } from "@supabase/supabase-js";
import { issueCode, verifyCode } from "@/lib/demo/verification";
import { parseDemoProfile, type DemoProfile } from "@/lib/demo/provision";
import { newLeadAlert } from "@/lib/notify/leadAlert";

// ============================================================
// THE GATED FUNNEL (Roman, 2026-10-12 01:40 ET)
// 1 account (name, email, phone, website, password) — no price shown
// 2 email verification code — info captured AND verified before any price
// 3 build show — the free wow moment (profile confirm/correct)
// 4 pricing revealed — pay to finish onboarding and unlock the dashboard
// No trial, no credits before payment, no business row before payment.
// ============================================================

export type FunnelStage = "account" | "verify" | "build" | "pricing" | "done";
export type FunnelSignup = {
  id: string; user_id: string; email: string; name: string; phone: string; website: string; domain: string;
  build_id: string | null; profile: DemoProfile | null; email_verified_at: string | null; pricing_seen_at: string | null; created_at: string; updated_at: string;
};
export class FunnelError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step-1 input. Website is normalized to https://host; domain kept separately. */
export function parseAccountInput(b: Record<string, unknown>): { name: string; email: string; phone: string; website: string; domain: string; password: string } | { error: string } {
  const name = clean(b.name, 80); const email = clean(b.email, 200).toLowerCase(); const phone = clean(b.phone, 32); const password = typeof b.password === "string" ? b.password : "";
  let site = clean(b.website, 300).toLowerCase(); if (site && !/^https?:\/\//.test(site)) site = `https://${site}`;
  let domain = ""; try { domain = new URL(site).hostname.replace(/^www\./, ""); } catch { domain = ""; }
  if (name.length < 2) return { error: "Enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter your work email." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a phone number with at least 10 digits." };
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "Enter your business website." };
  if (password.length < 8) return { error: "Create a password of at least 8 characters." };
  return { name, email, phone, website: `https://${domain}`, domain, password };
}

/** Pure: which step the visitor is on. A business with a plan means onboarding is paid for. */
export function stageFor(s: Pick<FunnelSignup, "email_verified_at" | "profile"> | null, hasBusiness: boolean): FunnelStage {
  if (hasBusiness) return "done";
  if (!s) return "account";
  if (!s.email_verified_at) return "verify";
  if (!s.profile) return "build";
  return "pricing";
}

export async function getSignup(db: SupabaseClient, userId: string): Promise<FunnelSignup | null> {
  const { data } = await db.from("funnel_signups").select("*").eq("user_id", userId).maybeSingle();
  return (data as FunnelSignup | null) ?? null;
}

/** Step 1: account (password set, email NOT confirmed until the code) + signup row + first code. */
export async function createAccount(db: SupabaseClient, input: { name: string; email: string; phone: string; website: string; domain: string; password: string }): Promise<{ userId: string }> {
  const { data: existing } = await db.from("users").select("id").eq("email", input.email).maybeSingle();
  let userId = existing?.id as string | undefined;
  if (userId) {
    const { data: biz } = await db.from("businesses").select("id").eq("owner_id", userId).not("plan_key", "is", null).limit(1).maybeSingle();
    if (biz) throw new FunnelError("exists", "This email already has an SFB Connect account. Sign in instead.", 409);
    const { data: s } = await db.from("funnel_signups").select("email_verified_at").eq("user_id", userId).maybeSingle();
    if (s?.email_verified_at) throw new FunnelError("exists", "This email is already verified. Sign in to continue where you left off.", 409);
    // Unverified, abandoned: let them start over with a fresh password.
    const { error } = await db.auth.admin.updateUserById(userId, { password: input.password, user_metadata: { full_name: input.name } });
    if (error) throw new FunnelError("account", error.message, 500);
  } else {
    const { data: created, error } = await db.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: false, user_metadata: { full_name: input.name } });
    if (error || !created.user) throw new FunnelError("account", error?.message || "Could not create the account.", 500);
    userId = created.user.id;
  }
  await db.from("users").update({ full_name: input.name }).eq("id", userId);
  const { error: sErr } = await db.from("funnel_signups").upsert({ user_id: userId, email: input.email, name: input.name, phone: input.phone, website: input.website, domain: input.domain, email_verified_at: null, profile: null, build_id: null }, { onConflict: "user_id" });
  if (sErr) throw new FunnelError("signup", sErr.message, 500);
  const code = await issueCode(db, userId, input.email, null);
  if (!code.ok) throw new FunnelError("code_send", "We couldn't send the verification email just now. Try again in a minute.", 502);
  return { userId };
}

/** Step 2: code → verified. Idempotent. */
export async function verifySignup(db: SupabaseClient, userId: string, code: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const s = await getSignup(db, userId); if (!s) return { ok: false, reason: "no_signup" };
  if (s.email_verified_at) return { ok: true };
  const v = await verifyCode(db, userId, code); if (!v.ok) return { ok: false, reason: v.reason };
  const now = new Date().toISOString();
  await db.from("funnel_signups").update({ email_verified_at: now }).eq("user_id", userId);
  await db.auth.admin.updateUserById(userId, { email_confirm: true }).catch(() => undefined);
  await db.from("billing_audit_log").insert({ business_id: null, action: "funnel_verified", detail: { user_id: userId, domain: s.domain } });
  await newLeadAlert(db, { source: "funnel_verified", name: s.name, email: s.email, phone: s.phone, website: s.website }).catch(() => undefined);
  return { ok: true };
}

/** Step 3: the confirmed profile from the build show. Only after verification. */
export async function saveProfile(db: SupabaseClient, userId: string, body: Record<string, unknown>): Promise<DemoProfile> {
  const s = await getSignup(db, userId); if (!s) throw new FunnelError("no_signup", "Start by creating your account.", 404);
  if (!s.email_verified_at) throw new FunnelError("unverified", "Verify your email first.", 403);
  const parsed = parseDemoProfile({ ...body, website: s.website, domain: s.domain, contactName: body.contactName ?? s.name, phone: body.phone ?? s.phone });
  if ("error" in parsed) throw new FunnelError("invalid", parsed.error, 400);
  const buildId = typeof body.buildId === "string" && /^[0-9a-f-]{36}$/.test(body.buildId) ? body.buildId : null;
  await db.from("funnel_signups").update({ profile: parsed.profile, build_id: buildId, phone: parsed.profile.phone, name: parsed.profile.contactName }).eq("user_id", userId);
  if (buildId) await db.from("demo_builds").update({ status: "claimed" }).eq("id", buildId);
  return parsed.profile;
}

export async function markPricingSeen(db: SupabaseClient, userId: string) {
  await db.from("funnel_signups").update({ pricing_seen_at: new Date().toISOString() }).eq("user_id", userId).is("pricing_seen_at", null);
}
