// Outbound rendering — the ONLY place outreach copy is assembled. Sources are
// (a) system presets in presets.ts (Roman's words, approved before they ship),
// (b) a customer's saved preset, or (c) a customer's own custom email. Every
// placeholder resolves from a verified fact or the sender's own profile; a
// template that references a fact we don't have is refused (never filled with
// a guess). No LLM in this path on purpose: what goes to a real inbox is
// deterministic, reviewable, and approved by a human first.
import { PRESETS, presetByKey, type Preset } from "./presets";

/** Any preset key, "saved:<uuid>" or "custom" — widened from the original five-key union when the library arrived (2026-10-12). */
export type TemplateKey = string;

export type TemplateVars = {
  company: string;            // prospect business name (for a consumer lead: the person's name)
  contact_name?: string | null;
  city?: string | null;
  category?: string | null;   // prospect category, e.g. "property management company"
  sender_name: string;        // the business owner's name
  sender_company: string;     // the business we send on behalf of
  sender_category?: string | null; // e.g. "roofing"
  offer_line?: string | null; // one honest sentence the owner approved (from the business profile)
  booking_time?: string | null;
  meet_url?: string | null;
  slots?: string | null;      // "Tue 10:00, Wed 2:00, Thu 9:30 (ET)"
  review_link?: string | null;
};

export type Template = { key: TemplateKey; subject: string; body: string; requires: (keyof TemplateVars)[] };
export type TemplateSource = { subject: string; body: string; requires?: (keyof TemplateVars)[]; label?: string };

/** Back-compat view of the presets (engine code and tests still read TEMPLATES[key]). */
export const TEMPLATES: Record<string, Template> = Object.fromEntries(PRESETS.map((p) => [p.key, { key: p.key, subject: p.subject, body: p.body, requires: p.requires }]));

/** The variables a customer may use in their own email, with the words they see. */
export const TEMPLATE_VARIABLES: { token: string; label: string; example: string }[] = [
  { token: "{{first_name}}", label: "Their first name (falls back to \"there\")", example: "Jane" },
  { token: "{{company}}", label: "Their business (or their name for a consumer lead)", example: "Acme Property Mgmt" },
  { token: "{{city}}", label: "Their city", example: "Tampa" },
  { token: "{{sender_name}}", label: "Your name", example: "Roman Royce" },
  { token: "{{sender_company}}", label: "Your business", example: "SFB Connect" },
  { token: "{{offer_line}}", label: "Your approved offer line", example: "We put one AI agent on a local business…" },
  { token: "{{slots_or_reply}}", label: "Open times, or \"reply with a time that suits you\"", example: "reply with a time that suits you" },
];

/** "Jane Example" → Jane; "Royce, Roman" (Last, First) → Roman; trailing punctuation never leaks into the greeting (found live 2026-10-12: "Hi Royce,,"). */
export const firstName = (full: string | null | undefined) => {
  const s = (full ?? "").trim(); if (!s) return null;
  const base = s.includes(",") ? (s.split(",")[1] ?? "").trim() || s.split(",")[0].trim() : s;
  const first = base.split(/\s+/)[0]?.replace(/[^\p{L}\p{N}'’\-.]+$/u, "").replace(/^[^\p{L}\p{N}]+/u, "");
  return first || null;
};

/** Placeholder aliases customers type naturally. */
const ALIASES: Record<string, string> = { "first name": "first_name", firstname: "first_name", name: "first_name", business: "company", "company name": "company", "your name": "sender_name", "your company": "sender_company", "your business": "sender_company", offer: "offer_line", "offer line": "offer_line", times: "slots_or_reply" };
const normalizeKey = (k: string) => { const t = k.trim().toLowerCase(); return ALIASES[t] ?? t.replace(/\s+/g, "_"); };

function derived(v: TemplateVars): Record<string, string> {
  const first = firstName(v.contact_name) ?? (v.company && v.contact_name === v.company ? firstName(v.company) : null);
  return {
    first_name: first ?? "there",
    greeting: first ? `Hi ${first},` : `Hi ${v.company} team,`,
    greeting_person: first ? `Hi ${first},` : "Hi there,",
    greeting_any: first ? `Hi ${first},` : v.company && v.contact_name !== v.company ? `Hi ${v.company} team,` : "Hi there,",
    sender_category_phrase: v.sender_category ? `, a ${v.sender_category} business` : "",
    sender_category_or_business: v.sender_category ? `${v.sender_category} business` : "business",
    city_phrase: v.city ? ` in ${v.city}` : "",
    category_or_business: v.category ? v.category.toLowerCase() : "business",
    sender_category_or_this: v.sender_category ? `${v.sender_category} work` : "this",
    slots_or_reply: v.slots ? `${v.slots} — or reply with a time that suits you` : "reply with a time that suits you",
    slots_or_reply_cap: v.slots ? `${v.slots} — or reply with a time that suits you` : "Reply with a time that suits you",
    meet_line: v.meet_url ? ` Video link: ${v.meet_url}` : "",
    review_link_line: v.review_link ? `Here's the link: ${v.review_link}` : "Reply to this email and I'll send the link.",
  };
}

export const KNOWN_PLACEHOLDERS = new Set<string>(["company", "contact_name", "city", "category", "sender_name", "sender_company", "sender_category", "offer_line", "booking_time", "meet_url", "slots", "review_link", "first_name", "greeting", "greeting_person", "greeting_any", "sender_category_phrase", "sender_category_or_business", "city_phrase", "category_or_business", "sender_category_or_this", "slots_or_reply", "slots_or_reply_cap", "meet_line", "review_link_line"]);

/** Pure: unknown placeholders in a customer-written template (after alias normalisation). Empty = valid. */
export function validateSource(src: { subject: string; body: string }): string[] {
  const bad = new Set<string>();
  for (const m of `${src.subject}\n${src.body}`.matchAll(/\{\{([^{}]+)\}\}/g)) { const k = normalizeKey(m[1]); if (!KNOWN_PLACEHOLDERS.has(k)) bad.add(m[1].trim()); }
  return Array.from(bad);
}

/** Renders any source (preset, saved, custom). Throws listing missing facts rather than inventing them; unknown placeholders throw too. */
export function renderSource(src: TemplateSource, v: TemplateVars): { subject: string; body: string } {
  const missing = (src.requires ?? ["sender_name", "sender_company"]).filter((k) => !v[k] || String(v[k]).trim() === "");
  if (missing.length) throw new Error(`Template "${src.label ?? "custom"}" needs facts we don't have: ${missing.join(", ")}`);
  const all: Record<string, string> = { ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x == null ? "" : String(x)])), ...derived(v) };
  const fill = (s: string) => s.replace(/\{\{([^{}]+)\}\}/g, (_, raw: string) => {
    const k = normalizeKey(raw);
    if (!(k in all)) throw new Error(`Template "${src.label ?? "custom"}" references unknown placeholder {{${raw.trim()}}}`);
    return all[k];
  });
  return { subject: fill(src.subject).replace(/\s+/g, " ").trim(), body: fill(src.body).replace(/\n{3,}/g, "\n\n").trim() };
}

/** Renders a system preset by key. */
export function renderTemplate(key: TemplateKey, v: TemplateVars): { subject: string; body: string } {
  const p: Preset | null = presetByKey(key);
  if (!p) throw new Error(`Unknown template "${key}"`);
  return renderSource({ subject: p.subject, body: p.body, requires: p.requires, label: p.key }, v);
}

/** Default 3-step sequence: day 0 intro, day 3 follow-up, day 7 last note. "intro" is a marker for the business's chosen intro template. */
export const DEFAULT_SEQUENCE_STEPS: { day: number; template: TemplateKey }[] = [
  { day: 0, template: "intro" },
  { day: 3, template: "follow_up_1" },
  { day: 7, template: "follow_up_2" },
];

/** Footer every outbound email carries. The unsubscribe link is real and one click. */
export const unsubscribeFooter = (url: string) => `\n\n—\nIf you'd rather not hear from us, one click and you won't: ${url}`;
