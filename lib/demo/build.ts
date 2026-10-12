import { fetchSite, marketFromHtml, htmlToText } from "@/lib/analyzer/checks";
import { resolveBusinessName, resolveLogo, isParked } from "@/lib/analyzer/identity";
import { normalizeInput } from "@/lib/analyzer/run";
import { extractMeta, extractTitle, extractLinks, extractHeadings, extractNavText, extractPhoneNumbers, extractVisibleText, decodeEntities } from "@/lib/research/htmlExtract";

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
  /** Secondary niche tags, e.g. ["coaching", "education"] under primary "community". */
  nicheTags: string[];
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

// ---- Niche classifier (scored, not first-match) ----
// Each vertical has keywords; every signal is scored by weight (title / og
// description count most, headings and nav next, body text least). Bare
// boilerplate words never count ("legal", "terms", "privacy", "contact"). The
// top vertical must clear a minimum score; the next two become secondary tags
// so the review screen can show "Community · coaching, education".
type VerticalDef = { label: string; strong: RegExp; weak?: RegExp };
const V = (label: string, strong: RegExp, weak?: RegExp): VerticalDef => ({ label, strong, weak });
export const VERTICALS: VerticalDef[] = [
  V("roofing", /\broof(ing|er|s)?\b/gi, /\bshingle|gutter|storm damage\b/gi),
  V("HVAC", /\bhvac\b|\bheating\b|air condition|\bfurnace/gi),
  V("plumbing", /\bplumb/gi, /\bdrain|water heater/gi),
  V("electrical", /\belectrician|\belectrical\b/gi),
  V("solar", /\bsolar\b/gi),
  V("landscaping", /\blandscap|\blawn\b/gi, /\bmow|irrigation|sod\b/gi),
  V("pest control", /\bpest\b|exterminat/gi),
  V("cleaning", /pressure wash|window clean|\bcleaning\b|janitorial|\bmaid/gi),
  V("painting", /\bpaint(ing|er|ers)\b/gi),
  V("remodeling", /\bremodel|\brenovat/gi, /\bkitchen|\bbath(room)?\b/gi),
  V("fencing", /\bfenc(e|ing)\b/gi),
  V("concrete & paving", /\bconcrete\b|\bpaving\b|\basphalt\b/gi),
  V("tree service", /tree (service|removal|trimming)|\barborist/gi),
  V("pool service", /\bpool (service|cleaning|repair)|\bpools?\b/gi),
  V("garage doors", /garage door/gi),
  V("moving", /\bmovers\b|moving (company|service)/gi),
  V("junk removal", /junk removal|\bhauling\b/gi),
  V("restoration", /\brestoration\b|water damage|\bmold\b/gi),
  V("dental", /\bdent(al|ist|istry)\b|orthodont/gi),
  V("med spa", /med ?spa|aesthetic|dermatolog|botox|filler/gi),
  V("chiropractic", /\bchiro/gi),
  V("physical therapy", /physical therap/gi),
  V("veterinary", /veterinar|animal hospital/gi),
  V("law firm", /law firm|\battorney|\blawyer|law office|personal injury|\bparalegal/gi),
  V("accounting", /\baccounting\b|\bcpa\b|bookkeep|tax (prep|return|service)/gi),
  V("insurance", /\binsurance\b/gi),
  V("mortgage", /\bmortgage\b|\blending\b|\blender\b/gi),
  V("real estate", /real estate|\brealtor|\brealty\b|homes for sale/gi),
  V("property management", /property management/gi),
  V("food & catering", /\brestaurant|\bcater|\bbakery|\bcafe\b|\bmenu\b/gi),
  V("auto repair", /auto repair|\bmechanic|collision|\btires?\b|oil change/gi),
  V("auto detailing", /\bdetailing\b/gi),
  V("salon", /\bsalon\b|\bbarber|\blash(es)?\b|\bnails?\b/gi),
  V("fitness", /\bfitness\b|\bgym\b|personal train|\byoga\b|pilates/gi),
  V("photo & video", /photograph|videograph/gi),
  V("events", /\bwedding|event planning|\bvenue\b/gi),
  V("marketing agency", /marketing agency|digital marketing|\bseo\b|web design|\bbranding\b|\bads? agency/gi),
  V("IT & software", /\bsoftware\b|\bsaas\b|it services|managed services|\bapp\b/gi),
  V("staffing", /\bstaffing\b|\brecruit/gi),
  V("childcare", /\bdaycare|childcare|preschool/gi),
  V("education", /\beducation\b|\bcourses?\b|\bacademy\b|\btraining\b|\btutor|\bcurriculum|\blessons?\b|\blearn(ing)?\b|\bschool\b/gi),
  V("coaching", /\bcoach(ing|es)?\b|\bmentor(ship|ing|s)?\b|\bmastermind\b|accountability/gi),
  V("community", /\bcommunity\b|\bmembership\b|\bmembers?\b|\bdiscord\b|inner circle|\bnetwork(ing)?\b|\btribe\b|\bcollective\b/gi),
  V("consulting", /\bconsult(ing|ant|ants)\b|\badvisory\b|fractional/gi),
  V("creator & media", /\bpodcast|\bnewsletter|\bcreator|\byoutube channel|\bcontent (studio|creation)/gi),
  V("ecommerce & retail", /\bshop\b|\bstore\b|add to cart|free shipping|\bboutique/gi),
  V("nonprofit", /\bnonprofit|non-profit|\bdonate\b|\bministry\b|\bchurch\b|501\(c\)/gi),
];
const NEVER = /\b(legal|terms|privacy|cookies?|contact|about|login|sign ?in)\b/gi;
export type NicheSignal = { text: string | null | undefined; weight: number };
export type NicheResult = { primary: string | null; tags: string[]; scores: Record<string, number> };
export const NICHE_MIN_SCORE = 3;

/** Score every vertical across weighted signals. Returns the winner (if it clears the minimum) and up to two secondary tags. Pure, tested. */
export function classifyNiche(signals: NicheSignal[]): NicheResult {
  const scores: Record<string, number> = {};
  for (const sgn of signals) {
    if (!sgn.text) continue;
    const text = sgn.text.replace(NEVER, " ").slice(0, 20000);
    for (const v of VERTICALS) {
      const strong = (text.match(v.strong) ?? []).length; const weak = v.weak ? (text.match(v.weak) ?? []).length : 0;
      if (!strong && !weak) continue;
      // Diminishing returns per signal so one repeated word doesn't dominate, weighted by where it appeared.
      scores[v.label] = (scores[v.label] ?? 0) + sgn.weight * (Math.min(strong, 5) + 0.5 * Math.min(weak, 4));
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] < NICHE_MIN_SCORE) return { primary: null, tags: [], scores };
  const [top, topScore] = ranked[0];
  const tags = ranked.slice(1, 4).filter(([, sc]) => sc >= Math.max(NICHE_MIN_SCORE, topScore * 0.3)).slice(0, 2).map(([l]) => l);
  return { primary: top, tags, scores };
}

/** Back-compat: the single vertical label (first signal is strongest). */
export function verticalFrom(...texts: (string | null | undefined)[]): string | null {
  return classifyNiche(texts.map((text, i) => ({ text, weight: i === 0 ? 4 : i === 1 ? 3 : 2 }))).primary;
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
  const base: BuildFacts = { url: norm.url, domain: norm.domain, name: null, nameSource: null, logoUrl: null, category: null, nicheTags: [], city: null, state: null, services: [], offerLine: null, toneNotes: [], socials: {}, phone: null, parked: false, reachable: false, reason: null };
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

  const niche = classifyNiche([
    // <title> is the strongest single signal a site gives about what it is (extractMeta only reads <meta>, which is why the title was silently skipped before).
    { text: extractTitle(html), weight: 4 }, { text: extractMeta(html, "og:title"), weight: 3 }, { text: extractMeta(html, "og:description"), weight: 3 }, { text: extractMeta(html, "description"), weight: 3 },
    { text: headings.join(" · "), weight: 2 }, { text: nav.join(" · "), weight: 2 }, { text: base.services.join(" · "), weight: 2 }, { text: text.slice(0, 6000), weight: 1 },
  ]);
  base.category = niche.primary; base.nicheTags = niche.tags;
  const market = marketFromHtml(html); const ms = splitMarket(market); base.city = ms.city; base.state = ms.state;
  emit({ type: "fact", key: "category", label: "Niche", value: base.category }); emit({ type: "fact", key: "nicheTags", label: "Also", value: base.nicheTags });
  emit({ type: "fact", key: "city", label: "City", value: base.city }); emit({ type: "fact", key: "state", label: "State", value: base.state });
  emit({ type: "step", text: base.category || market ? `Mapping your niche${base.category ? `: ${base.category}${base.nicheTags.length ? ` (also ${base.nicheTags.join(", ")})` : ""}` : ""}${market ? ` in ${market}` : ""}` : "Couldn't pin the niche or city from the page — confirm them next." });

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
