import type { SupabaseClient } from "@supabase/supabase-js";
import type { Candidate } from "./types";
import { canonicalDomain } from "../normalize";
import { normalizePhoneE164 } from "../reconcile";

/**
 * Dedup in three rings, all recorded as flags:
 *  1. within the batch (same domain / phone / name+city twice tonight)
 *  2. against the CRM: crm_leads and pending crm_research_results
 *  3. against prior accepted feed findings (so the same prospect is never
 *     filed into the task queue twice)
 */
export function dedupeBatch(cands: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return cands.map((c) => {
    const keys = [c.dedupeKey, c.canonicalDomain ? `d:${c.canonicalDomain}` : null, c.phoneE164 ? `p:${c.phoneE164}` : null].filter(Boolean) as string[];
    const dup = keys.some((k) => seen.has(k));
    keys.forEach((k) => seen.add(k));
    return dup && !c.flags.includes("duplicate_in_batch") ? { ...c, flags: [...c.flags, "duplicate_in_batch"] } : c;
  });
}

export type KnownKeys = { crm: Set<string>; prior: Set<string> };

/** Loads the keys already known to the CRM and to prior feed runs. Service client (RLS bypass is read-only here and the caller is server-side). */
export async function loadKnownKeys(service: SupabaseClient): Promise<KnownKeys> {
  const crm = new Set<string>();
  const prior = new Set<string>();
  const [leads, results, findings] = await Promise.all([
    service.from("crm_leads").select("website, phone").limit(5000),
    service.from("crm_research_results").select("website, phone, canonical_domain, primary_phone_e164").limit(5000),
    service.from("research_feed_findings").select("dedupe_key, canonical_domain, phone_e164").eq("accepted", true).limit(20000),
  ]);
  for (const r of (leads.data ?? []) as { website: string | null; phone: string | null }[]) {
    const d = r.website ? canonicalDomain(r.website) : null;
    if (d) crm.add(`d:${d}`);
    const p = normalizePhoneE164(r.phone);
    if (p) crm.add(`p:${p}`);
  }
  for (const r of (results.data ?? []) as { website: string | null; phone: string | null; canonical_domain: string | null; primary_phone_e164: string | null }[]) {
    const d = r.canonical_domain ?? (r.website ? canonicalDomain(r.website) : null);
    if (d) crm.add(`d:${d}`);
    const p = r.primary_phone_e164 ?? normalizePhoneE164(r.phone);
    if (p) crm.add(`p:${p}`);
  }
  for (const r of (findings.data ?? []) as { dedupe_key: string; canonical_domain: string | null; phone_e164: string | null }[]) {
    prior.add(r.dedupe_key);
    if (r.canonical_domain) prior.add(`d:${r.canonical_domain}`);
    if (r.phone_e164) prior.add(`p:${r.phone_e164}`);
  }
  return { crm, prior };
}

export function flagKnown(cands: Candidate[], known: KnownKeys): Candidate[] {
  return cands.map((c) => {
    const keys = [c.dedupeKey, c.canonicalDomain ? `d:${c.canonicalDomain}` : null, c.phoneE164 ? `p:${c.phoneE164}` : null].filter(Boolean) as string[];
    const flags = [...c.flags];
    if (keys.some((k) => known.crm.has(k)) && !flags.includes("duplicate_in_crm")) flags.push("duplicate_in_crm");
    if (keys.some((k) => known.prior.has(k)) && !flags.includes("duplicate_prior_finding")) flags.push("duplicate_prior_finding");
    return { ...c, flags };
  });
}
