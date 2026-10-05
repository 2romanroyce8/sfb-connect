import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalDomain } from "./normalize";
import { normalizePhoneE164 } from "./reconcile";

/**
 * Duplicate detection (Research Spec §23). Lookups only -- a human decides.
 * Matches on exact canonical domain, normalized phone, or exact seed URL
 * against existing leads and pending research. Never on name alone.
 */
export type DuplicateMatch = { kind: "lead" | "research"; id: string; name: string | null; reason: string; archived?: boolean };

export async function findDuplicates(
  supabase: SupabaseClient,
  input: { website?: string | null; phone?: string | null; seedUrls?: string[]; excludeResearchId?: string }
): Promise<DuplicateMatch[]> {
  const out: DuplicateMatch[] = [];
  const domain = input.website ? (canonicalDomain(input.website) || "").toLowerCase() : "";
  const phone = normalizePhoneE164(input.phone);
  const seeds = (input.seedUrls ?? []).map((s) => s.trim()).filter(Boolean);

  const [leadsByDomain, leadsByPhone, leadsBySeed, researchByDomain, researchByPhone] = await Promise.all([
    domain ? supabase.from("crm_leads").select("id, business_name, website, archived").ilike("website", `%${domain}%`).limit(10) : Promise.resolve({ data: [] as any[] }),
    phone ? supabase.from("crm_leads").select("id, business_name, phone, archived").limit(200) : Promise.resolve({ data: [] as any[] }),
    // source_urls is jsonb (not text[]) on both tables -- use JSON containment
    // (@>) per seed; an array-overlap operator here would silently match nothing.
    seeds.length
      ? supabase
          .from("crm_leads")
          .select("id, business_name, source_urls, archived")
          .or(seeds.map((s) => `source_urls.cs.${JSON.stringify([s])}`).join(","))
          .limit(10)
      : Promise.resolve({ data: [] as any[] }),
    domain ? supabase.from("crm_research_results").select("id, business_name, website, status").eq("status", "pending").ilike("website", `%${domain}%`).limit(10) : Promise.resolve({ data: [] as any[] }),
    phone ? supabase.from("crm_research_results").select("id, business_name, phone, status").eq("status", "pending").limit(200) : Promise.resolve({ data: [] as any[] }),
  ]);

  for (const l of leadsByDomain.data ?? []) if ((canonicalDomain(l.website || "") || "").toLowerCase() === domain) out.push({ kind: "lead", id: l.id, name: l.business_name, reason: `Same website domain (${domain})`, archived: l.archived });
  for (const l of leadsByPhone.data ?? []) if (normalizePhoneE164(l.phone) === phone && !out.some((o) => o.id === l.id)) out.push({ kind: "lead", id: l.id, name: l.business_name, reason: `Same phone (${phone})`, archived: l.archived });
  for (const l of leadsBySeed.data ?? []) if (!out.some((o) => o.id === l.id)) out.push({ kind: "lead", id: l.id, name: l.business_name, reason: "Same source URL", archived: l.archived });
  for (const r of researchByDomain.data ?? []) if (r.id !== input.excludeResearchId && (canonicalDomain(r.website || "") || "").toLowerCase() === domain) out.push({ kind: "research", id: r.id, name: r.business_name, reason: `Pending research with same domain (${domain})` });
  for (const r of researchByPhone.data ?? []) if (r.id !== input.excludeResearchId && normalizePhoneE164(r.phone) === phone && !out.some((o) => o.id === r.id)) out.push({ kind: "research", id: r.id, name: r.business_name, reason: `Pending research with same phone (${phone})` });
  return out;
}
