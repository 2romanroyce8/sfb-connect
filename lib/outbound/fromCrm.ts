// Copy CRM leads (crm_leads) into a business's outbound prospect list, by tag.
// Team owners only (route enforces). Skips blank / placeholder / malformed
// emails, dedupes by email (first lead wins — e.g. two offices sharing one
// inbox become one prospect), and skips emails already on the list. A shared
// website domain (unique per business) is dropped from the later prospect
// rather than skipping it, same as the CSV upload. 0 credits.
import type { SupabaseClient } from "@supabase/supabase-js";
import { EMAIL_PLACEHOLDER_RE } from "@/lib/crm/leadImport";
import { addProspect, OutboundError, type Actor } from "./engine";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type CrmLeadRow = { id: string; business_name: string | null; website: string | null; email: string | null; phone: string | null; city: string | null; state: string | null; custom_fields: Record<string, unknown> | null; created_at: string };
export type Skip = { lead_id: string; name: string; email: string | null; reason: "no_email" | "placeholder_email" | "invalid_email" | "duplicate_in_tag" | "already_on_list" | "no_name" | "error"; detail?: string };

export const cleanEmail = (raw: string | null | undefined): { email: string | null; reason?: "no_email" | "placeholder_email" | "invalid_email" } => {
  const e = (raw ?? "").trim().replace(/^mailto:/i, "").toLowerCase();
  if (!e) return { email: null, reason: "no_email" };
  if (EMAIL_PLACEHOLDER_RE.test(e) || /email\s*protected/i.test(e)) return { email: null, reason: "placeholder_email" };
  if (!EMAIL_RE.test(e)) return { email: null, reason: "invalid_email" };
  return { email: e };
};

/** Pure: which leads become prospects. Oldest lead first so the original office keeps the shared inbox. */
export function selectLeads(leads: CrmLeadRow[], existingEmails: Set<string>): { keep: (CrmLeadRow & { cleanEmail: string; merged: string[] })[]; skipped: Skip[] } {
  const sorted = [...leads].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byEmail = new Map<string, CrmLeadRow & { cleanEmail: string; merged: string[] }>();
  const skipped: Skip[] = [];
  for (const l of sorted) {
    const name = (l.business_name ?? "").trim();
    const c = cleanEmail(l.email);
    if (!c.email) { skipped.push({ lead_id: l.id, name, email: l.email, reason: c.reason! }); continue; }
    if (!name) { skipped.push({ lead_id: l.id, name, email: c.email, reason: "no_name" }); continue; }
    if (existingEmails.has(c.email)) { skipped.push({ lead_id: l.id, name, email: c.email, reason: "already_on_list" }); continue; }
    const first = byEmail.get(c.email);
    if (first) { first.merged.push(l.id); skipped.push({ lead_id: l.id, name, email: c.email, reason: "duplicate_in_tag", detail: `same inbox as ${first.business_name} (${first.city ?? "?"})` }); continue; }
    byEmail.set(c.email, { ...l, cleanEmail: c.email, merged: [] });
  }
  return { keep: Array.from(byEmail.values()), skipped };
}

const strCustom = (c: Record<string, unknown> | null) => Object.fromEntries(Object.entries(c ?? {}).filter(([, v]) => v != null && String(v).trim() !== "").map(([k, v]) => [k, String(v)]));
const domainOf = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:/i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };

export async function importCrmLeadsByTag(service: SupabaseClient, input: { businessId: string; tag: string; dryRun: boolean }, actor: Actor) {
  const tag = input.tag.trim().toLowerCase();
  const { data: leads, error } = await service.from("crm_leads").select("id, business_name, website, email, phone, city, state, custom_fields, created_at, tags").contains("tags", [tag]).eq("archived", false).limit(5000);
  if (error) throw new Error(error.message);
  const { data: existing } = await service.from("outbound_prospects").select("email, canonical_domain").eq("business_id", input.businessId);
  const emails = new Set<string>((existing ?? []).map((p) => (p.email as string | null)?.toLowerCase()).filter((x): x is string => !!x));
  const domains = new Set<string>((existing ?? []).map((p) => p.canonical_domain as string | null).filter((x): x is string => !!x));
  const { keep, skipped } = selectLeads((leads ?? []) as CrmLeadRow[], emails);
  const counts = (s: Skip[]) => s.reduce<Record<string, number>>((a, x) => ((a[x.reason] = (a[x.reason] ?? 0) + 1), a), {});
  const base = { tag, tagged: (leads ?? []).length, withRealEmail: (leads ?? []).filter((l) => !!cleanEmail(l.email as string).email).length, uniqueNew: keep.length, missingCity: keep.filter((l) => !l.city).length };
  if (input.dryRun) return { dryRun: true, ...base, skippedCounts: counts(skipped), skipped: skipped.filter((s) => s.reason === "duplicate_in_tag" || s.reason === "invalid_email" || s.reason === "no_name") };

  let imported = 0;
  for (const l of keep) {
    const d = domainOf(l.website);
    const website = d && domains.has(d) ? null : l.website;
    try {
      await addProspect(service, { businessId: input.businessId, name: l.business_name!.trim(), email: l.cleanEmail, phone: l.phone, website, city: l.city, state: l.state, category: "roofing company", source: "manual", customFields: { ...strCustom(l.custom_fields), crm_lead_id: l.id, crm_tag: tag } }, actor);
      imported++; emails.add(l.cleanEmail); if (d && website) domains.add(d);
    } catch (e) {
      skipped.push({ lead_id: l.id, name: l.business_name ?? "", email: l.cleanEmail, reason: e instanceof OutboundError && e.code === "duplicate" ? "already_on_list" : "error", detail: e instanceof Error ? e.message.slice(0, 120) : "failed" });
    }
  }
  const { count } = await service.from("outbound_prospects").select("id", { count: "exact", head: true }).eq("business_id", input.businessId);
  return { dryRun: false, ...base, imported, skippedCounts: counts(skipped), errors: skipped.filter((s) => s.reason === "error"), prospectsOnList: count ?? null };
}
