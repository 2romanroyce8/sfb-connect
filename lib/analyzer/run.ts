// Orchestrates the 7-day preview: normalize input → presence lookup (gives
// name/category/market) → the other four checks in parallel → stream each
// finding as it lands → cache the whole scan by domain for 24h.
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryHint, checkChat, checkOutbound, checkPresence, checkReviews, checkWebsite, fetchSite, marketFromHtml } from "./checks";
import { extractTitle } from "@/lib/research/htmlExtract";
import type { Finding, ScanEvent, ScanMeta, StoredScan } from "./types";

export const CACHE_HOURS = 24;
const SOCIAL_HOSTS = ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com", "x.com", "twitter.com"];

/** Same rule as the lookup edge function: a URL-ish input or a social link, else "needs_link". */
export function normalizeInput(input: string): { url: string; domain: string } | null {
  const t = input.trim();
  if (!t) return null;
  const looksLikeUrl = /^https?:\/\//i.test(t) || /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/|$)/i.test(t) || SOCIAL_HOSTS.some((h) => t.toLowerCase().includes(h));
  if (!looksLikeUrl) return null;
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try { const u = new URL(url); return { url: u.toString(), domain: u.hostname.replace(/^www\./, "").toLowerCase() }; } catch { return null; }
}

export async function readCache(service: SupabaseClient, domain: string): Promise<StoredScan | null> {
  const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
  const { data } = await service.from("analyzer_scans").select("result, created_at").eq("domain", domain).gte("created_at", since).maybeSingle();
  return (data?.result as StoredScan | undefined) ?? null;
}

export async function writeCache(service: SupabaseClient, domain: string, scan: StoredScan) {
  await service.from("analyzer_scans").upsert({ domain, result: scan, created_at: new Date().toISOString() }, { onConflict: "domain" });
}

/** Runs the scan, calling `emit` for every event. Resolves with the stored scan (or null on hard failure). */
export async function runScan(input: { url: string; domain: string }, emit: (e: ScanEvent) => void): Promise<StoredScan | null> {
  const startedAt = new Date().toISOString(); const t0 = Date.now();
  const findings: Finding[] = [];
  const push = (f: Finding) => { findings.push(f); emit({ type: "finding", finding: f }); };

  // Site fetch and presence lookup start together; website + chat only need the fetch,
  // outbound + reviews need name/category/market from the presence lookup.
  const siteP = fetchSite(input.url);
  const presenceP = checkPresence(input.url);

  const siteChecks = siteP.then((site) => { push(checkWebsite(site)); push(checkChat(site)); return site; });
  const [presence, site] = await Promise.all([presenceP, siteChecks]);
  // Structured data first; the page itself as a real fallback (name/title for category, "City, ST" for market).
  const category = presence.category ?? categoryHint(presence.businessName, site.ok ? extractTitle(site.html) : null, input.domain.replace(/[-.]/g, " "));
  const market = presence.market ?? (site.ok ? marketFromHtml(site.html) : null);
  const meta: ScanMeta = { domain: input.domain, url: input.url, businessName: presence.businessName, category, market, cached: false, startedAt };
  emit({ type: "meta", meta });
  push(presence.finding);
  await Promise.all([
    checkOutbound(category, market).then(push),
    checkReviews(presence.businessName, market, category).then(push),
  ]);
  emit({ type: "done", durationMs: Date.now() - t0 });
  return { meta, findings };
}

/** Replays a cached scan through the same event shape (instant). */
export function replayScan(scan: StoredScan, emit: (e: ScanEvent) => void) {
  emit({ type: "meta", meta: { ...scan.meta, cached: true } });
  for (const f of scan.findings) emit({ type: "finding", finding: f });
  emit({ type: "done", durationMs: 0 });
}
