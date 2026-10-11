// Orchestrates the 7-day preview: normalize input → presence lookup (gives
// name/category/market) → the other four checks in parallel → stream each
// finding as it lands → cache the whole scan by domain for 24h.
import type { SupabaseClient } from "@supabase/supabase-js";
import { categoryHint, checkChat, checkOutbound, checkPresence, checkReviews, checkWebsite, fetchSite, marketFromHtml } from "./checks";
import { extractTitle } from "@/lib/research/htmlExtract";
import { isParked, resolveBusinessName, resolveLogo } from "./identity";
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
export async function runScan(input: { url: string; domain: string; enteredQuery?: string }, emit: (e: ScanEvent) => void): Promise<StoredScan | null> {
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
  // Identity for the header: title → JSON-LD → lookup; logo only if it really serves an image.
  const parked = site.ok && isParked(site.html);
  const ident = resolveBusinessName(site.ok ? site.html : null, presence.businessName);
  const logo = site.ok && !parked ? await resolveLogo(site.html, site.finalUrl) : { url: null, source: null };
  const name = ident.name;
  if (parked) {
    // A for-sale domain has no business behind it: refuse to score it rather than report "errors" for a parking page.
    presence.finding = { ...presence.finding, status: "missing", headline: "This domain appears to be parked or for sale.", items: [], reason: "There's no business website here to read yet — the agent would start by getting a real site live.", metrics: { parked: 1 } };
  } else if (name && presence.finding.status === "found") {
    const n = Number(presence.finding.metrics.issues ?? 0);
    presence.finding.headline = `Your visibility score is ${presence.finding.metrics.score}/100. Found ${n} listing ${n === 1 ? "error" : "errors"} for ${name}.`;
  }
  const meta: ScanMeta = {
    domain: input.domain, url: input.url, enteredQuery: input.enteredQuery ?? input.domain, businessName: name, nameSource: ident.source, logoUrl: logo.url, parked, category: parked ? null : category, market: parked ? null : market, cached: false, startedAt,
    debug: { logoSource: logo.source, categorySource: presence.category ? "lookup" : category ? "page" : "none", marketSource: presence.market ? "lookup" : market ? "page" : "none", siteOk: site.ok, siteBytes: site.bytes, siteStatus: site.status, siteFinalUrl: site.finalUrl, siteReason: site.reason, hasCommaState: site.ok ? /, (OK|TX|CA|FL|NY)\b/.test(site.html) : null,
      rawSample: site.ok ? (site.html.match(/.{0,40}, (?:OK|TX|CA|FL|NY)\b.{0,20}/g) ?? []).slice(0, 3).join(" || ") : null,
      textSample: site.ok ? (site.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").match(/.{0,40}, (?:OK|TX|CA|FL|NY)\b.{0,20}/g) ?? []).slice(0, 3).join(" || ") : null },
  };
  emit({ type: "meta", meta });
  push(presence.finding);
  if (parked) {
    push({ check: "outbound", capability: "outbound_gtm", status: "missing", headline: "No business to prospect for yet.", items: [], reason: "The domain is parked — there's nothing public that says what the business does or where.", metrics: {}, sources: [] });
    push({ check: "reviews", capability: "reviews_reputation", status: "missing", headline: "No business listing to match.", items: [], reason: "The domain is parked — no name or location to look up.", metrics: {}, sources: [] });
  } else {
    await Promise.all([
      checkOutbound(category, market, name).then(push),
      checkReviews(name ?? presence.businessName, market, category).then(push),
    ]);
  }
  emit({ type: "done", durationMs: Date.now() - t0 });
  return { meta, findings };
}

/** Replays a cached scan through the same event shape (instant). */
export function replayScan(scan: StoredScan, emit: (e: ScanEvent) => void) {
  emit({ type: "meta", meta: { ...scan.meta, cached: true } });
  for (const f of scan.findings) emit({ type: "finding", finding: f });
  emit({ type: "done", durationMs: 0 });
}
