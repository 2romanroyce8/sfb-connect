// Outbound message templates — the ONLY source of outreach copy. Every
// placeholder resolves from a verified fact or the sender's own profile; a
// template that references a fact we don't have is refused (never filled with
// a guess). No LLM in this path on purpose: what goes to a real inbox is
// deterministic, reviewable, and approved by a human first.

export type TemplateKey = "intro" | "follow_up_1" | "follow_up_2" | "reply_thanks" | "booking_confirmation";

export type TemplateVars = {
  company: string;            // prospect business name (required)
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
};

export type Template = { key: TemplateKey; subject: string; body: string; requires: (keyof TemplateVars)[] };

export const TEMPLATES: Record<TemplateKey, Template> = {
  intro: {
    key: "intro",
    subject: "{{sender_company}} × {{company}}",
    body: `{{greeting}}

I run {{sender_company}}{{sender_category_phrase}}{{city_phrase}}. I'm reaching out because {{company}} is the kind of {{category_or_business}} we work alongside well.

{{offer_line}}

If it's useful, I can hold a 15-minute slot this week — {{slots_or_reply}}.

{{sender_name}}
{{sender_company}}`,
    requires: ["company", "sender_name", "sender_company", "offer_line"],
  },
  follow_up_1: {
    key: "follow_up_1",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}

Following up on my note from earlier this week. No pressure — if the timing is wrong, a one-word "later" is a perfectly good answer.

If it's right, {{slots_or_reply}}.

{{sender_name}}`,
    requires: ["company", "sender_name", "sender_company"],
  },
  follow_up_2: {
    key: "follow_up_2",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}

Last note from me. If {{company}} ever wants a second set of hands on {{sender_category_or_this}}, my door's open.

{{sender_name}}
{{sender_company}}`,
    requires: ["company", "sender_name", "sender_company"],
  },
  reply_thanks: {
    key: "reply_thanks",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}

Thanks for getting back to me. Here are a few times that work on my side — {{slots}} — or send one that suits you and I'll fit around it.

{{sender_name}}`,
    requires: ["company", "sender_name", "sender_company", "slots"],
  },
  booking_confirmation: {
    key: "booking_confirmation",
    subject: "Confirmed: {{sender_company}} × {{company}} — {{booking_time}}",
    body: `{{greeting}}

Locked in: {{booking_time}}.{{meet_line}}

Talk soon,
{{sender_name}}
{{sender_company}}`,
    requires: ["company", "sender_name", "sender_company", "booking_time"],
  },
};

const firstName = (full: string | null | undefined) => (full ?? "").trim().split(/\s+/)[0] || null;

/** Renders a template. Throws listing the missing facts rather than inventing them. */
export function renderTemplate(key: TemplateKey, v: TemplateVars): { subject: string; body: string } {
  const t = TEMPLATES[key];
  const missing = t.requires.filter((k) => !v[k] || String(v[k]).trim() === "");
  if (missing.length) throw new Error(`Template "${key}" needs facts we don't have: ${missing.join(", ")}`);
  const derived: Record<string, string> = {
    greeting: firstName(v.contact_name) ? `Hi ${firstName(v.contact_name)},` : `Hi ${v.company} team,`,
    sender_category_phrase: v.sender_category ? `, a ${v.sender_category} business` : "",
    city_phrase: v.city ? ` in ${v.city}` : "",
    category_or_business: v.category ? v.category.toLowerCase() : "business",
    sender_category_or_this: v.sender_category ? `${v.sender_category} work` : "this",
    slots_or_reply: v.slots ? `${v.slots} — or reply with a time that suits you` : "reply with a time that suits you",
    meet_line: v.meet_url ? ` Video link: ${v.meet_url}` : "",
  };
  const all: Record<string, string> = { ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x == null ? "" : String(x)])), ...derived };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in all)) throw new Error(`Template "${key}" references unknown placeholder {{${k}}}`);
    return all[k];
  });
  return { subject: fill(t.subject).replace(/\s+/g, " ").trim(), body: fill(t.body).replace(/\n{3,}/g, "\n\n").trim() };
}

/** Default 3-step sequence: day 0 intro, day 3 follow-up, day 7 last note. */
export const DEFAULT_SEQUENCE_STEPS: { day: number; template: TemplateKey }[] = [
  { day: 0, template: "intro" },
  { day: 3, template: "follow_up_1" },
  { day: 7, template: "follow_up_2" },
];

/** Footer every outbound email carries. The unsubscribe link is real and one click. */
export const unsubscribeFooter = (url: string) => `\n\n—\nIf you'd rather not hear from us, one click and you won't: ${url}`;
