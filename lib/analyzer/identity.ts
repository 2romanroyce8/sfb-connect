// Business identity for the report header: name, logo, the exact URL entered.
// Name order (Roman): page title → schema/JSON-LD → Google Business Profile
// (the lookup's name). Logo order: header logo → og:image → favicon.
// Nothing is guessed: a name that fails the cleanliness checks is dropped
// (generic headline), and a logo URL is only returned if it actually serves
// an image. A wrong name or a broken image kills trust instantly.
import { extractTitle, extractMeta, extractJsonLd, findLocalBusiness } from "@/lib/research/htmlExtract";

const GENERIC = /^(home|homepage|welcome|index|untitled|website|site|coming soon|under construction|loading|page not found|404)$/i;
const SEPARATORS = /\s+[|\-–—·•:]\s+|\s+[|]\s*|\s*[|]\s+/;

function clean(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.replace(/\s+/g, " ").replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").trim();
  if (t.length < 2 || t.length > 60) return null;
  if (GENERIC.test(t)) return null;
  if (/[<>{}]/.test(t) || /https?:\/\//i.test(t)) return null;
  if (!/[a-z]/i.test(t)) return null;
  return t;
}

/** Brand segment of a <title>: "Limitless Roofing OKC LLC | Oklahoma City's Trusted Roofer" → "Limitless Roofing OKC LLC". */
export function nameFromTitle(title: string | null): string | null {
  if (!title) return null;
  const parts = title.split(SEPARATORS).map((p) => clean(p)).filter((p): p is string => !!p);
  if (parts.length === 0) return null;
  // Brands come first in a title almost always; take the first segment that isn't a slogan or a
  // descriptor ("Oklahoma City's Trusted Roofer", "Austin TX Dentist"). Never shortest-wins.
  const descriptor = (p: string) => /[.!?]$/.test(p) || /\b(best|trusted|top|#1|your|we|our|near me|services?|dentist|roofer|plumber|contractor|lawyer|attorney|clinic)\b/i.test(p) || /\b[A-Z]{2}\b/.test(p) && p.split(" ").length <= 4 && /\b(TX|OK|CA|FL|NY|AZ|CO|GA|NC|WA|IL|OH|PA|MI|TN|VA|NJ|MA|MD|MO|IN|WI|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY)\b/.test(p);
  return parts.find((p) => p.split(" ").length <= 6 && !descriptor(p)) ?? parts[0] ?? null;
}

export function nameFromJsonLd(html: string): string | null {
  const lb = findLocalBusiness(extractJsonLd(html));
  const n = lb?.name;
  return clean(typeof n === "string" ? n : null);
}

/** Title → JSON-LD → lookup (GBP-equivalent). Null when none is clean. */
export function resolveBusinessName(html: string | null, lookupName: string | null): { name: string | null; source: "title" | "jsonld" | "lookup" | null } {
  if (html) {
    const t = nameFromTitle(extractTitle(html));
    if (t) return { name: t, source: "title" };
    const j = nameFromJsonLd(html);
    if (j) return { name: j, source: "jsonld" };
  }
  const l = clean(lookupName);
  return l ? { name: l, source: "lookup" } : { name: null, source: null };
}

const abs = (src: string, base: string): string | null => { try { return new URL(src, base).toString(); } catch { return null; } };

/** Candidate logo URLs in priority order: header <img> that looks like a logo → og:image → icons. */
export function logoCandidates(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const push = (u: string | null) => { if (u && /^https?:/i.test(u) && !out.includes(u)) out.push(u); };
  const header = (html.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? "") + (html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? "");
  const imgRe = /<img[^>]+>/gi; let m: RegExpExecArray | null;
  const scope = header || html.slice(0, 60_000);
  while ((m = imgRe.exec(scope))) {
    const tag = m[0];
    if (!/logo|brand/i.test(tag)) continue;
    if (/\.svg|\.png|\.webp|\.jpe?g|\.gif/i.test(tag) || /src=/i.test(tag)) {
      const src = tag.match(/\s(?:data-src|src)=["']([^"']+)["']/i)?.[1] ?? null;
      if (src && !/^data:/i.test(src)) push(abs(src, baseUrl));
    }
  }
  push(abs(extractMeta(html, "og:image") ?? "", baseUrl));
  const linkRe = /<link[^>]+rel=["']([^"']+)["'][^>]*>/gi;
  const icons: { rel: string; href: string }[] = [];
  while ((m = linkRe.exec(html))) {
    const rel = m[1].toLowerCase(); const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (href && /icon/.test(rel)) icons.push({ rel, href });
  }
  for (const i of icons.sort((a, b) => (a.rel.includes("apple") ? -1 : 1) - (b.rel.includes("apple") ? -1 : 1))) push(abs(i.href, baseUrl));
  push(abs("/favicon.ico", baseUrl));
  return out;
}

/** First candidate that really serves an image (HEAD, falls back to GET). Null → the UI shows the initial tile. */
export async function resolveLogo(html: string, baseUrl: string): Promise<{ url: string | null; source: string | null }> {
  const cands = logoCandidates(html, baseUrl);
  for (const [i, url] of cands.entries()) {
    try {
      const controller = new AbortController(); const t = setTimeout(() => controller.abort(), 4000);
      let res = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "follow" });
      if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) res = await fetch(url, { method: "GET", signal: controller.signal, redirect: "follow", headers: { range: "bytes=0-0" } });
      clearTimeout(t);
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.startsWith("image/")) return { url: res.url || url, source: i === cands.length - 1 ? "favicon" : /og|opengraph/i.test(url) ? "og:image" : /icon/i.test(url) ? "icon" : "header" };
    } catch { /* next candidate */ }
  }
  return { url: null, source: null };
}

export const initialOf = (name: string | null, domain: string) => ((name ?? domain).trim()[0] ?? "?").toUpperCase();
