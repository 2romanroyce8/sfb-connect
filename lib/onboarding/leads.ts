// Step 7 — the agent finds candidates from the ICP (Exa, company category);
// the customer reviews; accepted ones become outbound_prospects (status
// "sourced", 0 credits — enrichment and writing are charged later, with
// approval). Candidates are stored on the onboarding row so a mid-review exit
// resumes with the same list. Nothing is contacted here.
import type { SupabaseClient } from "@supabase/supabase-js";
import { addProspect, OutboundError } from "@/lib/outbound/engine";
import { logSearchCall } from "@/lib/research/usage";
import { icpQueries, type Icp } from "./icp";

export type LeadCandidate = { id: string; name: string; website: string; domain: string; snippet: string; query: string; city: string | null; state: string | null };

const domainOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return null; } };
const JUNK = /yelp\.|yellowpages|bbb\.org|facebook\.com|linkedin\.com|instagram\.com|angi\.com|homeadvisor|thumbtack|houzz|nextdoor|google\.com|wikipedia|indeed\.com|glassdoor|zillow|realtor\.com|mapquest|manta\.com|chamberofcommerce|clutch\.co|crunchbase|expertise\.com|threebestrated/i;

/** Pure: turn Exa results into deduped candidates, dropping directories, the business itself and anything already on the list. */
export function toCandidates(results: { title?: string | null; url: string; text?: string | null; summary?: string | null }[], query: string, exclude: Set<string>, location: string | null): LeadCandidate[] {
  const out: LeadCandidate[] = [];
  const [city, state] = (location ?? "").split(",").map((s) => s.trim());
  for (const r of results) {
    if (!r.url || JUNK.test(r.url)) continue;
    const domain = domainOf(r.url); if (!domain || exclude.has(domain)) continue;
    const name = (r.title ?? "").replace(/\s*[|–—-]\s*(home|homepage|official site|welcome).*$/i, "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (name.length < 2) continue;
    exclude.add(domain);
    out.push({ id: domain, name, website: `https://${domain}`, domain, snippet: (r.text ?? r.summary ?? "").replace(/\s+/g, " ").trim().slice(0, 220), query, city: city || null, state: state && /^[A-Z]{2}$/.test(state) ? state : null });
  }
  return out;
}

export async function sourceCandidates(service: SupabaseClient, business: { id: string; website: string | null }, icp: Icp, opts: { limit?: number; fetchImpl?: typeof fetch } = {}): Promise<{ candidates: LeadCandidate[]; queries: string[]; error?: string }> {
  const apiKey = process.env.EXA_API_KEY; const f = opts.fetchImpl ?? fetch; const limit = opts.limit ?? 25;
  if (!apiKey) return { candidates: [], queries: [], error: "Lead search isn't configured (EXA_API_KEY)." };
  const { data: existing } = await service.from("outbound_prospects").select("canonical_domain").eq("business_id", business.id);
  const exclude = new Set<string>((existing ?? []).map((p) => p.canonical_domain as string).filter(Boolean));
  const own = business.website ? domainOf(business.website) : null; if (own) exclude.add(own);
  const queries = icpQueries(icp); const candidates: LeadCandidate[] = [];
  const perQuery = Math.max(4, Math.ceil(limit / Math.max(1, queries.length)));
  for (const query of queries) {
    if (candidates.length >= limit) break;
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 9000);
    try {
      const res = await f("https://api.exa.ai/search", { method: "POST", headers: { "content-type": "application/json", "x-api-key": apiKey }, body: JSON.stringify({ query, numResults: perQuery, type: "auto", category: "company", contents: { text: { maxCharacters: 400 } } }), signal: ctrl.signal });
      void logSearchCall("exa", query);
      if (!res.ok) continue;
      const j = (await res.json()) as { results?: { title?: string | null; url: string; text?: string | null; summary?: string | null }[] };
      const loc = icp.locations.find((l) => query.endsWith(` in ${l}`)) ?? null;
      candidates.push(...toCandidates(j.results ?? [], query, exclude, loc));
    } catch { /* one query failing must not kill the run */ } finally { clearTimeout(timer); }
  }
  return { candidates: candidates.slice(0, limit), queries };
}

/** Accept reviewed candidates → prospects (status sourced). Returns per-candidate outcome; duplicates are reported, not errors. */
export async function acceptCandidates(service: SupabaseClient, businessId: string, candidates: LeadCandidate[], actor: { id: string; label: string }) {
  const out: { id: string; status: "added" | "duplicate" | "error"; message?: string }[] = [];
  for (const c of candidates) {
    try { await addProspect(service, { businessId, name: c.name, website: c.website, city: c.city, state: c.state, category: c.query.split(" in ")[0] }, { kind: "user", id: actor.id, label: actor.label }); out.push({ id: c.id, status: "added" }); }
    catch (e) { if (e instanceof OutboundError && e.code === "duplicate") out.push({ id: c.id, status: "duplicate" }); else out.push({ id: c.id, status: "error", message: e instanceof Error ? e.message : "failed" }); }
  }
  return out;
}
