// Server side of onboarding: gathers the real facts for deriveOnboarding and
// owns the single writable row. Every write checks the caller owns the business.
import type { SupabaseClient } from "@supabase/supabase-js";
import { deriveOnboarding, type OnboardingFacts, type OnboardingState } from "./flow";

export type OnboardingRow = {
  business_id: string; confirmed_steps: Record<string, string>; step_data: Record<string, unknown>;
  dfy_choice: string | null; dfy_chosen_at: string | null; started_at: string; dismissed_at: string | null; completed_at: string | null; last_step: number;
};

export type BusinessProfile = {
  id: string; owner_id: string; legal_name: string; website: string | null; primary_category: string | null; niche_tags: string[]; city: string | null; state: string | null;
  phone: string | null; services: string[] | null; outbound_offer_line: string | null; description: string | null; brand_logo_url: string | null; brand_colors: string[] | null;
  icp: Record<string, unknown> | null; plan_key: string | null;
};

const BIZ_COLS = "id, owner_id, legal_name, website, primary_category, niche_tags, city, state, phone, services, outbound_offer_line, description, brand_logo_url, brand_colors, icp, plan_key";

export async function ensureRow(service: SupabaseClient, businessId: string): Promise<OnboardingRow> {
  const { data } = await service.from("customer_onboarding").select("*").eq("business_id", businessId).maybeSingle();
  if (data) return data as OnboardingRow;
  // First render of a brand-new customer: the portal layout and the page both land here in parallel.
  // An insert raced itself on the primary key (found live 2026-10-12) — upsert-ignore, then read.
  const { error } = await service.from("customer_onboarding").upsert({ business_id: businessId }, { onConflict: "business_id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  const { data: row, error: readErr } = await service.from("customer_onboarding").select("*").eq("business_id", businessId).single();
  if (readErr || !row) throw new Error(readErr?.message ?? "Onboarding row missing after upsert.");
  return row as OnboardingRow;
}

export async function loadOnboarding(service: SupabaseClient, businessId: string): Promise<{ state: OnboardingState; row: OnboardingRow; business: BusinessProfile; integrations: { gmail: string | null; calendar: string | null } }> {
  const { data: biz } = await service.from("businesses").select(BIZ_COLS).eq("id", businessId).single();
  if (!biz) throw new Error("Business not found.");
  const business = biz as BusinessProfile;
  const [row, { data: gmail }, { data: cal }, { count: prospects }, { count: seqs }, { count: inSeq }, { count: sentMsgs }] = await Promise.all([
    ensureRow(service, businessId),
    service.from("integration_connections").select("account_label").eq("provider", "gmail").eq("owner_id", business.owner_id).eq("status", "active").limit(1).maybeSingle(),
    service.from("crm_calendar_connections").select("google_email, refresh_failed_at").eq("rep_id", business.owner_id).maybeSingle(),
    service.from("outbound_prospects").select("id", { count: "exact", head: true }).eq("business_id", businessId),
    service.from("outbound_sequences").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active"),
    service.from("outbound_prospects").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["in_sequence", "replied", "booked"]),
    service.from("outbound_messages").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("direction", "out").in("status", ["approved", "sent"]),
  ]);
  const calendarOk = !!cal && !cal.refresh_failed_at;
  const facts: OnboardingFacts = {
    gmailConnected: !!gmail, calendarConnected: calendarOk, hasLogo: !!business.brand_logo_url, hasIcp: !!business.icp,
    prospectCount: prospects ?? 0, activeSequence: (seqs ?? 0) > 0, dfyChoice: row.dfy_choice,
    campaignLaunched: (inSeq ?? 0) > 0 || (sentMsgs ?? 0) > 0,
    confirmedSteps: row.confirmed_steps ?? {}, dismissedAt: row.dismissed_at, completedAt: row.completed_at,
  };
  return { state: deriveOnboarding(facts), row, business, integrations: { gmail: (gmail?.account_label as string | null) ?? null, calendar: calendarOk ? (cal!.google_email as string) : null } };
}

/** The signed-in customer's business (plan_key set), or null. */
export async function customerBusiness(supabase: SupabaseClient): Promise<{ userId: string; businessId: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: biz } = await supabase.from("businesses").select("id").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return biz ? { userId: user.id, businessId: biz.id } : null;
}

export async function confirmStep(service: SupabaseClient, businessId: string, step: number) {
  const row = await ensureRow(service, businessId);
  const confirmed = { ...(row.confirmed_steps ?? {}), [String(step)]: new Date().toISOString() };
  const patch: Record<string, unknown> = { confirmed_steps: confirmed, last_step: Math.max(row.last_step, step), updated_at: new Date().toISOString() };
  if (step === 11) patch.completed_at = row.completed_at ?? new Date().toISOString();
  await service.from("customer_onboarding").update(patch).eq("business_id", businessId);
}

export async function saveStepData(service: SupabaseClient, businessId: string, step: number, data: unknown) {
  const row = await ensureRow(service, businessId);
  await service.from("customer_onboarding").update({ step_data: { ...(row.step_data ?? {}), [String(step)]: data }, last_step: Math.max(row.last_step, step), updated_at: new Date().toISOString() }).eq("business_id", businessId);
}
