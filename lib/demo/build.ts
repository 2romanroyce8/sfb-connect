import { fetchSite, marketFromHtml, htmlToText } from "@/lib/analyzer/checks";
import { resolveBusinessName, resolveLogo, isParked } from "@/lib/analyzer/identity";
import { normalizeInput } from "@/lib/analyzer/run";
import { extractMeta, extractLinks, extractHeadings, extractNavText, extractPhoneNumbers, extractVisibleText, decodeEntities } from "@/lib/research/htmlExtract";

// ============================================================
// THE BUILD SHOW — what the agent learns from a website, honestly.
//
// Every fact comes from the site itself (title/og/JSON-LD, nav + headings,
// visible text, links). Anything we can't find is null and the review
// screen asks the owner. Nothing here is generated, estimated or padded.
// ============================================================

export type BuildFacts = {
  url: string; domain: string;
  name: string | null; nameSource: string | null;
  logoUrl: string | null;
  category: string | null;
  city: string | null; state: string | null;
  services: string[];
  offerLine: string | null;
  toneNotes: string[];
  socials: Record<string, string>;
  phone: string | null;
  parked: boolean;
  reachable: boolean; reason: string | null;
};
export type BuildEvent = { type: "step"; text: string } | { type: "fact"; key: keyof BuildFacts; label: string; value: unknown } | { type: "done"; facts: BuildFacts } | { type: "error"; message: string };

const SOCIAL_HOSTS: Record<string, RegExp> = {
  facebook: /(^|\.)facebook\.com$/i, instagram: /(^|\.)instagram\.com$/i, linkedin: /(^|\.)linkedin\.com$/i, x: /(^|\.)(x|twitter)\.com$/i,
  tiktok: /(^|\.)tiktok\.com$/i, youtube: /(^|\.)(youtube\.com|youtu\.be)$/i, yelp: /(^|\.)yelp\.com$/i, google: /(^|\.)(g\.page|business\.google\.com)$/i,
};

/** Social profile links found on the page, one per network, never a share/intent link. */
export function extractSocials(links: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of links) {
    let u: URL; try { u = new URL(l); } catch { continue; }
    if (/sharer|share\.php|intent\/|\/share\?/i.test(u.href)) continue;
    for (const [k, re] of Object.entries(SOCIAL_HOSTS)) {
      if (re.test(u.hostname) && !out[k] && u.pathname.length > 1) out[k] = u.origin + u.pathname.replace(/\/+$/, "");
    }
  }
  return out;
}

const SERVICE_STOP = /^(home|about(\s+us)?|contact(\s+us)?|blog|news|careers?|faq|login|sign\s*in|sign\s*up|privacy|terms|gallery|reviews?|testimonials?|our\s+team|team|locations?|financing|menu|book(\s+now)?|schedule|get\s+a\s+quote|free\s+estimate|request\s+a\s+quote|call\s+now|learn\s+more|read\s+more|services?|portfolio|projects?|resources|shop|cart|search|español|en\s+español)$/i;
const SERVICE_HINT = /(repair|install|replacement|cleaning|roofing|roof|plumbing|hvac|heating|cooling|air|electrical|painting|remodel|renovation|landscap|lawn|tree|pest|window|door|siding|gutter|flooring|tile|concrete|paving|fence|deck|pool|solar|insulation|restoration|detailing|towing|moving|storage|dental|implant|whitening|orthodont|chiropract|massage|therapy|injury|accident|estate|divorce|tax|bookkeeping|payroll|marketing|seo|web|design|photo|video|wedding|catering|training|coaching|tutoring|daycare|grooming|veterinar|salon|spa|nails|lash|barber|tattoo|fitness|yoga|auto|brake|tire|oil|glass|locksmith|security|cctv|wiring|generator|septic|drain|water|mold|fire|smoke|carpet|upholstery|pressure|washing|junk|hauling|demolition|excavat|grading|foundation|waterproof|basement|kitchen|bath|cabinet|countertop|garage|epoxy|inspection|appraisal|notary|insurance|mortgage|lending|rental|property|management|staffing|consult|commercial|residential|emergency)/i;

const VERTICALS: [RegExp, string][] = [
  [/\broof/i, "roofing"], [/\bhvac\b|heating|air condition/i, "HVAC"], [/plumb/i, "plumbing"], [/electric/i, "electrical"], [/solar/i, "solar"], [/landscap|lawn care|lawn/i, "landscaping"], [/pest/i, "pest control"],
  [/pressure wash|window clean|cleaning|janitorial|maid/i, "cleaning"], [/paint/i, "painting"], [/remodel|renovat|kitchen|bath/i, "remodeling"], [/fenc/i, "fencing"], [/concrete|paving|asphalt/i, "concrete & paving"], [/tree service|arborist/i, "tree service"],
  [/pool/i, "pool service"], [/garage door/i, "garage doors"], [/mov(ing|ers)/i, "moving"], [/junk|hauling/i, "junk removal"], [/restoration|water damage|mold/i, "restoration"], [/dent(al|ist)|orthodont/i, "dental"], [/med ?spa|aesthetic|dermatolog/i, "med spa"],
  [/chiro/i, "chiropractic"], [/physical therapy/i, "physical therapy"], [/veterinar|animal hospital/i, "veterinary"], [/law firm|attorney|lawyer|legal/i, "law firm"], [/accounting|cpa|bookkeep|tax/i, "accounting"], [/insurance/i, "insurance"], [/mortgage|lend/i, "mortgage"],
  [/real estate|realtor|realty/i, "real estate"], [/property management/i, "property management"], [/restaurant|cater|bakery|cafe/i, "food & catering"], [/auto repair|mechanic|collision|tire/i, "auto repair"], [/detailing/i, "auto detailing"], [/salon|barber|lash|nail/i, "salon"],
  [/fitness|gym|personal train|yoga|pilates/i, "fitness"], [/photograph|videograph/i, "photo & video"], [/wedding|event planning/i, "events"], [/marketing agency|digital marketing|seo|web design/i, "marketing agency"], [/software|saas|it services|managed services/i, "IT & software"], [/staffing|recruit/i, "staffing"], [/daycare|childcare|preschool/i, "childcare"], [/tutor|academy|training/i, "education"],
];
/** The vertical in one or two words ("roofing"), from the most specific text first; null when nothing matches. */
export function verticalFrom(...texts: (string | null | undefined)[]): string | null {
  for (const t of texts) { if (!t) continue; for (const [re, label] of VERTICALS) if (re.test(t)) return label; }
  return null;
}

/** Service names from nav + headings: short, service-like, de-duplicated, never boilerplate. */
export function extractServices(navItems: string[], headings: string[], businessName: string | null = null): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  const nameTokens = (businessName ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^(the|and|llc|inc|co|of)$/.test(w));
  const push = (raw: string) => {
    const s = decodeEntities(raw).replace(/\s+/g, " ").replace(/[|•·›»>]+/g, " ").trim().replace(/^[-–—\s]+|[-–—\s:]+$/g, "");
    if (s.length < 3 || s.length > 48) return;
    if (SERVICE_STOP.test(s)) return;
    if (!SERVICE_HINT.test(s)) return;
    if (/\d{3}[-.)\s]\d{3}/.test(s) || /@/.test(s)) return;
    const words = s.split(" "); if (words.length > 6) return;
    // Taglines, widget text and the business's own name are not services.
    if (/[…]|\.\.\.$/.test(s) || /\b(llc|inc|corp|ltd)\b/i.test(s) || /^(no|our|your|we|why|how|what|the|a|an|get|your)\b/i.test(s) || /checking|loading|condition|welcome|beyond|trusted|#1|best\b/i.test(s)) return;
    const lower = s.toLowerCase(); if (nameTokens.length >= 2 && nameTokens.filter((w) => lower.includes(w)).length >= 2) return;
    const key = s.toLowerCase(); if (seen.has(key)) return;
    seen.add(key); out.push(s);
  };
  for (const n of navItems) push(n);
  for (const h of headings) push(h);
  return out.slice(0, 12);
}

/** Plain, checkable observations about how the site is written. Not a personality profile. */
export function toneNotesFromText(text: string): string[] {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 200) return [];
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => s.split(" ").length >= 4);
  if (sentences.length < 5) return [];
  const words = t.split(" ").length;
  const avgLen = sentences.reduce((a, s) => a + s.split(" ").length, 0) / sentences.length;
  const we = (t.match(/\b(we|our|us)\b/gi) ?? []).length; const i = (t.match(/\b(I|my|me)\b/g) ?? []).length; const you = (t.match(/\b(you|your)\b/gi) ?? []).length;
  const excl = (t.match(/!/g) ?? []).length / sentences.length;
  const contractions = (t.match(/\b\w+'(re|ll|ve|d|s|t|m)\b/gi) ?? []).length / Math.max(1, words / 100);
  const casual = (t.match(/\b(hey|y'all|folks|awesome|no problem|hassle|stress|we've got you|got your back|honest|straight)\b/gi) ?? []).length;
  const formal = (t.match(/\b(utilize|leverage|solutions|comprehensive|industry-leading|synerg|stakeholder|deliverable|state-of-the-art)\b/gi) ?? []).length;
  const notes: string[] = [];
  notes.push(we > i * 2 ? "Speaks as \"we\"" : i > we ? "Speaks as \"I\" — owner voice" : "Mixes \"we\" and \"I\"");
  if (you / sentences.length > 0.6) notes.push("Talks to the reader as \"you\" a lot");
  notes.push(avgLen <= 13 ? "Short sentences" : avgLen >= 22 ? "Long, detailed sentences" : "Medium-length sentences");
  if (excl > 0.15) notes.push("Uses exclamation points");
  if (contractions > 1.5) notes.push("Contractions — conversational"); else if (contractions < 0.3) notes.push("No contractions — formal");
  if (casual >= 2 && formal === 0) notes.push("Plain, friendly wording"); else if (formal >= 2) notes.push("Corporate wording (\"solutions\", \"comprehensive\")");
  return notes.slice(0, 5);
}

/** The one-line offer: og:description / meta description / first substantial heading, trimmed; null when nothing fits. */
export function offerLineFrom(html: string, headings: string[]): string | null {
  const cands = [extractMeta(html, "og:description"), extractMeta(html, "description"), ...headings.slice(0, 6)].filter((s): s is string => !!s).map((s) => decodeEntities(s).replace(/\s+/g, " ").trim());
  for (const c of cands) { if (c.length >= 25 && c.length <= 180 && !/cookie|javascript|browser|copyright|©/i.test(c)) return c; }
  return null;
}

/** US "City, ST" → parts. */
export function splitMarket(market: string | null): { city: string | null; state: string | null } {
  const m = market?.match(/^(.+?),\s*([A-Z]{2})$/); return m ? { city: m[1].trim(), state: m[2] } : { city: null, state: null };
}

export function slugify(name: string): string {
  return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "business";
}

/** Runs the build show. Emits steps as it goes; the final event carries every fact. Never throws. */
export async function buildProfileFromSite(input: string, emit: (e: BuildEvent) => void): Promise<BuildFacts | null> {
  const norm = normalizeInput(input);
  if (!norm) { emit({ type: "error", message: "That doesn't look like a website address." }); return null; }
  const base: BuildFacts = { url: norm.url, domain: norm.domain, name: null, nameSource: null, logoUrl: null, category: null, city: null, state: null, services: [], offerLine: null, toneNotes: [], socials: {}, phone: null, parked: false, reachable: false, reason: null };
  emit({ type: "step", text: `Reading ${norm.domain}…` });
  const site = await fetchSite(norm.url);
  if (!site.ok || !site.html) { emit({ type: "error", message: site.reason ?? "We couldn't read the site." }); return { ...base, reason: site.reason }; }
  base.reachable = true;
  const html = site.html;
  if (isParked(html)) { base.parked = true; emit({ type: "error", message: "That domain looks parked / for sale — there's no business to learn from yet." }); return base; }

  const nameR = resolveBusinessName(html, null);
  base.name = nameR.name; base.nameSource = nameR.source;
  emit({ type: "fact", key: "name", label: "Business name", value: base.name });
  emit({ type: "step", text: base.name ? `Found the business: ${base.name}` : "Couldn't read a clean business name — you can type it." });

  const nav = extractNavText(html); const headings = extractHeadings(html);
  base.services = extractServices(nav, headings, base.name);
  emit({ type: "fact", key: "services", label: "Services", value: base.services });
  emit({ type: "step", text: base.services.length ? `Found ${base.services.length} service${base.services.length === 1 ? "" : "s"}` : "No service list found on the homepage — add yours on the next screen." });

  const text = extractVisibleText(html) || htmlToText(html);
  base.toneNotes = toneNotesFromText(text);
  emit({ type: "fact", key: "toneNotes", label: "Writing style", value: base.toneNotes });
  emit({ type: "step", text: base.toneNotes.length ? "Learning your tone…" : "Not enough copy on the homepage to learn a tone yet." });

  base.category = verticalFrom(extractMeta(html, "og:description"), extractMeta(html, "description"), extractMeta(html, "title"), base.services.join(" · "), text.slice(0, 4000));
  const market = marketFromHtml(html); const ms = splitMarket(market); base.city = ms.city; base.state = ms.state;
  emit({ type: "fact", key: "category", label: "Niche", value: base.category });
  emit({ type: "fact", key: "city", label: "City", value: base.city }); emit({ type: "fact", key: "state", label: "State", value: base.state });
  emit({ type: "step", text: base.category || market ? `Mapping your niche${base.category ? `: ${base.category}` : ""}${market ? ` in ${market}` : ""}` : "Couldn't pin the niche or city from the page — confirm them next." });

  base.socials = extractSocials(extractLinks(html, site.finalUrl));
  emit({ type: "fact", key: "socials", label: "Social links", value: base.socials });
  if (Object.keys(base.socials).length) emit({ type: "step", text: `Found ${Object.keys(base.socials).length} social profile${Object.keys(base.socials).length === 1 ? "" : "s"}` });

  base.offerLine = offerLineFrom(html, headings);
  emit({ type: "fact", key: "offerLine", label: "Your one-line offer", value: base.offerLine });

  const phones = extractPhoneNumbers(html); base.phone = phones[0] ?? null;
  emit({ type: "fact", key: "phone", label: "Phone", value: base.phone });

  emit({ type: "step", text: "Looking for your logo…" });
  const logo = await resolveLogo(html, site.finalUrl); base.logoUrl = logo.url;
  emit({ type: "fact", key: "logoUrl", label: "Logo", value: base.logoUrl });
  emit({ type: "step", text: base.logoUrl ? "Got your logo" : "No clean logo found — you can add one later." });

  emit({ type: "done", facts: base });
  return base;
}
