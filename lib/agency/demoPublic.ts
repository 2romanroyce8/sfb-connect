import { createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Trade } from "@/lib/mk/trades";

// Public read of ONE published demo plus the owning agency's public branding. Service client on purpose (visitors are anonymous), but it selects only
// public columns and only status = 'published'; nothing about clients, members or other demos is reachable from here.
export type PublicDemo = {
  id: string; agencyId: string; agencySlug: string; slug: string; businessName: string; website: string | null; location: string | null; industryKey: string | null;
  brand: { name: string; logoUrl: string | null; color: string | null; bookingUrl: string | null; contactEmail: string | null };
  pack: { name: string; services: string[]; questions: string[] } | null;
};
const SLUG = /^[a-z0-9][a-z0-9-]{1,60}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const httpsOnly = (u: unknown) => (typeof u === "string" && /^https:\/\/[^\s]+$/i.test(u) ? u : null);

export async function getPublicDemo(agencySlug: string, slug: string): Promise<PublicDemo | null> {
  if (!SLUG.test(agencySlug) || !SLUG.test(slug)) return null;
  const db = createSupabaseServiceClient();
  const { data: ag } = await db.from("agencies").select("id, slug, name, status").eq("slug", agencySlug).maybeSingle();
  if (!ag || ag.status !== "active") return null;
  const { data: d } = await db.from("agy_demo_projects").select("id, slug, business_name, website_url, location, industry_key, status").eq("agency_id", ag.id).eq("slug", slug).eq("status", "published").maybeSingle();
  if (!d) return null;
  const [{ data: b }, { data: p }] = await Promise.all([
    db.from("agency_branding").select("display_name, logo_url, primary_color, contact_email, booking_url").eq("agency_id", ag.id).maybeSingle(),
    d.industry_key ? db.from("agy_industry_packs").select("name, config, agency_id").eq("key", d.industry_key).or(`agency_id.is.null,agency_id.eq.${ag.id}`).order("agency_id", { ascending: false, nullsFirst: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const cfg = (p?.config ?? {}) as { services?: string[]; qualification_questions?: string[] };
  return {
    id: d.id as string, agencyId: ag.id as string, agencySlug: ag.slug as string, slug: d.slug as string, businessName: d.business_name as string, website: httpsOnly(d.website_url), location: (d.location as string | null) ?? null, industryKey: (d.industry_key as string | null) ?? null,
    brand: { name: (b?.display_name as string) || (ag.name as string), logoUrl: httpsOnly(b?.logo_url), color: HEX.test(String(b?.primary_color ?? "")) ? (b!.primary_color as string) : null, bookingUrl: httpsOnly(b?.booking_url), contactEmail: typeof b?.contact_email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact_email) ? b.contact_email : null },
    pack: p ? { name: p.name as string, services: Array.isArray(cfg.services) ? cfg.services.slice(0, 8) : [], questions: Array.isArray(cfg.qualification_questions) ? cfg.qualification_questions.slice(0, 5) : [] } : null,
  };
}

const clean = (s: string, n: number) => s.replace(/[\r\n\t]+/g, " ").replace(/[<>{}`]/g, "").trim().slice(0, n);
/** The demo as a Trade for the demo stage / voice prompt. Free text is length-limited and stripped of control characters. */
export function demoToTrade(d: PublicDemo): Trade {
  const first = d.pack?.services[0]?.toLowerCase();
  return { key: `demo:${d.agencySlug}/${d.slug}`, label: d.pack?.name ?? "business", biz: clean(d.businessName, 80), service: first ? `${/^[aeiou]/.test(first) ? "an" : "a"} ${clean(first, 40)} appointment` : "an appointment", city: clean(d.location ?? "", 60) || "your area", asks: d.pack?.questions.length ? d.pack.questions.slice(0, 3).map((q) => clean(q, 80)) : ["What services do you offer?", "How much does it cost?", "Can I book this week?"] };
}
