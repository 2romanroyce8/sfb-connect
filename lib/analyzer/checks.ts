// The five public-data checks. Each returns a Finding and NEVER throws —
// a failure becomes status "missing" with the real reason. Nothing here
// estimates, extrapolates or fills a blank with a plausible number.
import { runBusinessLookup } from "@/lib/runBusinessLookup";
import { exaProvider } from "@/lib/research/providers/exa";
import { extractTitle, extractMeta, extractJsonLd, extractLinks } from "@/lib/research/htmlExtract";
import { icpFor } from "./icp";
import type { Finding } from "./types";

export type SiteFetch = { ok: boolean; url: string; finalUrl: string; html: string; ttfbMs: number | null; bytes: number; status: number | null; reason: string | null };

/** One fetch of the homepage shared by the website + chat checks, with first-byte timing measured from our server. */
export async function fetchSite(url: string): Promise<SiteFetch> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12000);
  const started = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-language": "en-US,en;q=0.9" } });
    const ttfbMs = Date.now() - started;
    const html = (await res.text()).slice(0, 1_500_000);
    clearTimeout(t);
    if (!res.ok) return { ok: false, url, finalUrl: res.url || url, html, ttfbMs, bytes: html.length, status: res.status, reason: `The site answered ${res.status}.` };
    return { ok: true, url, finalUrl: res.url || url, html, ttfbMs, bytes: html.length, status: res.status, reason: null };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, url, finalUrl: url, html: "", ttfbMs: null, bytes: 0, status: null, reason: e instanceof Error && e.name === "AbortError" ? "The site took longer than 12 seconds to answer." : "We couldn't reach the site from our server." };
  }
}

// ---------- 1. AI Presence (existing rule-based lookup; no LLM, nothing invented) ----------
export async function checkPresence(url: string): Promise<{ finding: Finding; businessName: string | null; category: string | null; market: string | null }> {
  const out = await runBusinessLookup(url);
  if (out.status !== "completed") {
    return { finding: { check: "presence", capability: "ai_presence", status: "missing", headline: "Couldn't read your listings.", items: [], reason: out.message || "The public lookup didn't complete.", metrics: {}, sources: [] }, businessName: null, category: null, market: null };
  }
  const r = out.result;
  const issues = [...r.gaps, ...r.missing];
  return {
    finding: {
      check: "presence", capability: "ai_presence", status: "found",
      headline: `Your visibility score is ${r.scores.overall}/100. Found ${issues.length} listing ${issues.length === 1 ? "error" : "errors"}.`, // personalized in run.ts once the name is resolved
      items: issues, reason: issues.length === 0 ? "No listing errors in the public signals we checked." : null,
      metrics: { score: r.scores.overall, issues: issues.length }, sources: r.sources,
    },
    businessName: r.business.name.value, category: r.business.category.value, market: r.business.location.value,
  };
}

// Real fallbacks when the structured lookup leaves category/market empty:
// the business name and <title> often say what it does ("Limitless Roofing OKC"),
// and the page footer usually carries a "City, ST" address. Both are read, not guessed.
// Literal regex on purpose (no template/string construction) so the bundler can't alter it.
const CITY_STATE_RE = /\b([A-Z][a-zA-Z.]+(?: [A-Z][a-zA-Z.]+){0,2}),\s*(A[LKZR]|C[AOT]|D[EC]|FL|GA|HI|I[DLNA]|K[SY]|LA|M[EDAINSOT]|N[EVHJMYCD]|O[HKR]|PA|RI|S[CD]|T[NX]|UT|V[TA]|W[AVIY])\b(?:\s+\d{5})?/;
export function htmlToText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ");
}
export function marketFromHtml(html: string): string | null {
  const m = htmlToText(html).match(CITY_STATE_RE);
  return m ? `${m[1]}, ${m[2]}` : null;
}
export function categoryHint(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) if (t && icpFor(t)) return t;
  return null;
}

// ---------- 2. Outbound: first-pass prospect count in their market (Exa, real results, distinct domains) ----------
export async function checkOutbound(category: string | null, market: string | null, name: string | null = null): Promise<Finding> {
  const icp = icpFor(category);
  const base: Omit<Finding, "status" | "headline" | "reason" | "metrics" | "items" | "sources"> = { check: "outbound", capability: "outbound_gtm" };
  if (!icp) return { ...base, status: "missing", headline: "Couldn't determine your ideal customer from public data.", items: [], reason: category ? `We saw "${category}" but don't have an ideal-customer profile for it yet.` : "Your site doesn't state what the business does in a way we could classify.", metrics: {}, sources: [] };
  if (!market) return { ...base, status: "missing", headline: "Couldn't determine your market.", items: [], reason: "No city or service area is stated on your site in a form we could read.", metrics: {}, sources: [] };
  if (!exaProvider.isConfigured()) return { ...base, status: "missing", headline: "Prospect search isn't available right now.", items: [], reason: "Our search provider isn't configured on this deployment.", metrics: {}, sources: [] };
  const results = await Promise.all(icp.queries.map((q) => exaProvider.search({ query: `${q} in ${market}`, maxResults: 10 })));
  const domains = new Set<string>();
  for (const r of results.flat()) { try { domains.add(new URL(r.url).hostname.replace(/^www\./, "")); } catch { /* skip */ } }
  const n = domains.size;
  if (n === 0) return { ...base, status: "missing", headline: `No ${icp.label} surfaced in ${market} on a first pass.`, items: [], reason: "Three search passes returned nothing usable — the agent would widen the radius with you.", metrics: { prospects: 0 }, sources: ["exa"] };
  return { ...base, status: "found", headline: name ? `Found ${n} ${icp.label} near ${name}'s market (${market}) on a first pass.` : `Found ${n} ${icp.label} in ${market} on a first pass.`, items: [...domains].slice(0, 5), reason: `First pass only: ${icp.queries.length} searches, up to 10 results each, distinct domains counted. The full build goes much deeper.`, metrics: { prospects: n, market, icp: icp.label }, sources: ["exa"] };
}

// ---------- 3. Reviews: Google Places if a key exists; otherwise an honest missing row ----------
export async function checkReviews(businessName: string | null, market: string | null, category: string | null): Promise<Finding> {
  const base = { check: "reviews" as const, capability: "reviews_reputation" as const };
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return { ...base, status: "missing", headline: "Couldn't read your reviews from public data.", items: [], reason: "Reading your Google rating and review responses needs a Google Business Profile connection — the agent asks for it on day 1.", metrics: {}, sources: [] };
  if (!businessName) return { ...base, status: "missing", headline: "Couldn't match your business to a Google listing.", items: [], reason: "Your site doesn't state the business name in a form we could match.", metrics: {}, sources: [] };
  try {
    const q = encodeURIComponent(`${businessName} ${market ?? ""}`.trim());
    const r = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${q}&inputtype=textquery&fields=place_id,rating,user_ratings_total,name&key=${key}`);
    const j = (await r.json()) as { candidates?: { place_id: string; rating?: number; user_ratings_total?: number; name: string }[] };
    const c = j.candidates?.[0];
    if (!c) return { ...base, status: "missing", headline: "Couldn't find your Google Business Profile.", items: [], reason: `No listing matched "${businessName}"${market ? ` in ${market}` : ""}.`, metrics: {}, sources: ["google_places"] };
    let competitors: { name: string; rating: number }[] = [];
    if (category && market) {
      const nr = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${category} in ${market}`)}&key=${key}`);
      const nj = (await nr.json()) as { results?: { name: string; rating?: number; place_id: string }[] };
      competitors = (nj.results ?? []).filter((x) => x.place_id !== c.place_id && typeof x.rating === "number").slice(0, 5).map((x) => ({ name: x.name, rating: x.rating! }));
    }
    const avg = competitors.length ? Math.round((competitors.reduce((s, x) => s + x.rating, 0) / competitors.length) * 10) / 10 : null;
    const rating = c.rating ?? null; const total = c.user_ratings_total ?? 0;
    return {
      ...base, status: "found",
      headline: rating === null ? `${total} Google reviews, no rating yet.` : `Rated ${rating} on Google across ${total} reviews${avg !== null ? ` — nearby competitors average ${avg}` : ""}.`,
      items: competitors.map((x) => `${x.name}: ${x.rating}`),
      reason: "Unanswered-review count needs your Google Business Profile connected — the public API doesn't expose owner replies.",
      metrics: { rating, total, competitorAvg: avg }, sources: ["google_places"],
    };
  } catch {
    return { ...base, status: "missing", headline: "Couldn't read your reviews right now.", items: [], reason: "Google's Places API didn't answer.", metrics: {}, sources: ["google_places"] };
  }
}

// ---------- 4. Website: three quick-hit fixes from what we actually observed ----------
const BOOKING_HINTS = /calendly|acuity|squareup\.com\/appointments|book(ing)?\b|schedule|appointment|housecall|servicetitan|jobber|setmore|zocdoc|vagaro|mindbody/i;
export function websiteFixesFromHtml(site: SiteFetch): { fixes: string[]; metrics: Record<string, number | string | null> } {
  const html = site.html;
  const fixes: string[] = [];
  const title = extractTitle(html); const desc = extractMeta(html, "description"); const h1s = (html.match(/<h1[\s>]/gi) ?? []);
  const jsonLd = extractJsonLd(html); const links = extractLinks(html, site.finalUrl);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasTel = /href=["']tel:/i.test(html);
  const hasBooking = BOOKING_HINTS.test(html) || links.some((l) => BOOKING_HINTS.test(l));
  const hasForm = /<form[\s>]/i.test(html);
  const https = site.finalUrl.startsWith("https://");
  if (site.ttfbMs !== null && site.ttfbMs > 1500) fixes.push(`Slow first byte (${(site.ttfbMs / 1000).toFixed(1)}s from our server) — cache or move the homepage`);
  if (site.bytes > 600_000) fixes.push(`Heavy homepage HTML (${Math.round(site.bytes / 1024)} KB) — trim scripts and inline assets`);
  if (!https) fixes.push("Site isn't served over HTTPS");
  if (!title || title.length < 10) fixes.push("Missing or thin <title> tag"); else if (title.length > 65) fixes.push(`Title tag is ${title.length} characters — trim to under 60`);
  if (!desc) fixes.push("No meta description");
  if (h1s.length === 0) fixes.push("No H1 headline");
  if (!hasViewport) fixes.push("No mobile viewport tag");
  if (jsonLd.length === 0) fixes.push("No schema.org structured data (LocalBusiness)");
  if (!hasTel) fixes.push("Phone number isn't tap-to-call (no tel: link)");
  if (!hasBooking && !hasForm) fixes.push("No booking link or contact form on the homepage");
  else if (!hasBooking) fixes.push("No online booking — only a contact form");
  return { fixes, metrics: { ttfbMs: site.ttfbMs, bytes: site.bytes, title: title ?? null, hasBooking: hasBooking ? 1 : 0, hasTel: hasTel ? 1 : 0, jsonLd: jsonLd.length } };
}

export function checkWebsite(site: SiteFetch): Finding {
  const base = { check: "website" as const, capability: "website" as const };
  if (!site.ok) return { ...base, status: "missing", headline: "Couldn't load your homepage.", items: [], reason: site.reason ?? "Unknown fetch error.", metrics: { status: site.status }, sources: [site.finalUrl] };
  const { fixes, metrics } = websiteFixesFromHtml(site);
  const top = fixes.slice(0, 3);
  return {
    ...base, status: "found",
    headline: top.length ? `${top.length} quick-hit ${top.length === 1 ? "fix" : "fixes"} on your homepage.` : "No quick-hit fixes found on your homepage.",
    items: top, reason: fixes.length > 3 ? `${fixes.length - 3} more found; showing the top 3.` : top.length ? null : "Speed, SEO basics and booking path all pass a 30-second check.",
    metrics: { ...metrics, totalFixes: fixes.length }, sources: [site.finalUrl],
  };
}

// ---------- 5. Chat: is there a chat widget at all? (after-hours answering can't be seen from outside) ----------
const CHAT_VENDORS: [RegExp, string][] = [[/intercom/i, "Intercom"], [/drift\.com|js\.driftt/i, "Drift"], [/tidio/i, "Tidio"], [/crisp\.chat/i, "Crisp"], [/tawk\.to/i, "tawk.to"], [/hs-scripts|hubspot.*conversations|usemessages/i, "HubSpot chat"], [/livechatinc|livechat\.com/i, "LiveChat"], [/zopim|zendesk.*web_widget|zdassets/i, "Zendesk"], [/podium/i, "Podium"], [/birdeye/i, "Birdeye"], [/gorgias/i, "Gorgias"], [/connect\.facebook\.net.*customerchat|fb-customerchat/i, "Messenger chat"], [/smartsupp/i, "Smartsupp"], [/olark/i, "Olark"], [/freshchat|freshworks/i, "Freshchat"], [/chatwoot/i, "Chatwoot"], [/leadconnectorhq|msgsndr/i, "LeadConnector (GHL) chat"]];
export function detectChat(html: string): string | null {
  for (const [re, name] of CHAT_VENDORS) if (re.test(html)) return name;
  return null;
}
export function checkChat(site: SiteFetch): Finding {
  const base = { check: "chat" as const, capability: "chat_texting" as const };
  if (!site.ok) return { ...base, status: "missing", headline: "Couldn't check your site for chat.", items: [], reason: site.reason ?? "Unknown fetch error.", metrics: {}, sources: [site.finalUrl] };
  const vendor = detectChat(site.html);
  if (!vendor) return { ...base, status: "found", headline: "No chat on your site — nobody answers after hours.", items: [], reason: null, metrics: { hasChat: 0 }, sources: [site.finalUrl] };
  return { ...base, status: "found", headline: `${vendor} is installed.`, items: [], reason: "Whether it answers after hours can't be seen from outside — the agent checks the response log on day 1.", metrics: { hasChat: 1, vendor }, sources: [site.finalUrl] };
}
