// The template LIBRARY — every system preset the compose flow offers. Pure
// data. Copy is Roman's voice and ships only after he has read it (approval
// 2026-10-12 pending for everything marked `approvedAt: "2026-10-12"`). Placeholders
// are the shared variable set in templates.ts; a preset that references a
// fact we don't have is refused at render time, never filled with a guess.
import type { TemplateVars } from "./templates";

export type PresetCategory = "intro_b2b" | "intro_b2c" | "follow_up" | "re_engagement" | "booking_nudge" | "review_request" | "testimonial_request" | "system";
export type PresetTone = "direct" | "warm" | "formal" | "friendly" | "plain";
export type PresetAudience = "business" | "consumer" | "any";
export type Preset = { key: string; name: string; category: PresetCategory; tone: PresetTone; audience: PresetAudience; description: string; subject: string; body: string; requires: (keyof TemplateVars)[]; approvedAt: string | null; /** SFB Connect's own outreach (Rome's name and pitch in the copy): offered only to businesses owned by a team owner, never to customers. */ teamOnly?: boolean };

export const PRESET_CATEGORIES: { key: PresetCategory; label: string; hint: string }[] = [
  { key: "intro_b2b", label: "Intro — to a business", hint: "First note to a company you want to work with." },
  { key: "intro_b2c", label: "Intro — to a person", hint: "First note to a consumer (homeowner, patient, resident…)." },
  { key: "follow_up", label: "Follow-ups", hint: "Steps 2–4 of a sequence." },
  { key: "re_engagement", label: "Re-engagement", hint: "Someone who went quiet weeks or months ago." },
  { key: "booking_nudge", label: "Booking nudge", hint: "They showed interest; make the call easy to book." },
  { key: "review_request", label: "Review request", hint: "Ask a happy customer for a public review." },
  { key: "testimonial_request", label: "Testimonial request", hint: "Ask for a quote you can publish." },
];

const SIGN = `{{sender_name}}\n{{sender_company}}`;
const B2B_REQ: (keyof TemplateVars)[] = ["company", "sender_name", "sender_company"];
const B2C_REQ: (keyof TemplateVars)[] = ["sender_name", "sender_company"];

export const PRESETS: Preset[] = [
  // ---- Intro — business (the first one is the original "intro", unchanged) ----
  { key: "intro", name: "Business intro — direct", category: "intro_b2b", tone: "direct", audience: "business", description: "The original. States who you are, why them, your offer, a 15-minute ask.", approvedAt: "2026-10-11",
    subject: "{{sender_company}} × {{company}}",
    body: `{{greeting}}\n\nI run {{sender_company}}{{sender_category_phrase}}{{city_phrase}}. I'm reaching out because {{company}} is the kind of {{category_or_business}} we work alongside well.\n\n{{offer_line}}\n\nIf it's useful, I can hold a 15-minute slot this week — {{slots_or_reply}}.\n\n${SIGN}`,
    requires: [...B2B_REQ, "offer_line"] },
  { key: "intro_b2b_warm", name: "Business intro — warm", category: "intro_b2b", tone: "warm", audience: "business", description: "Same ask, softer open; leads with respect for their work.", approvedAt: "2026-10-12",
    subject: "A note for the team at {{company}}",
    body: `{{greeting}}\n\nI've come across {{company}} more than once{{city_phrase}} — you're clearly doing the work well. I run {{sender_company}}{{sender_category_phrase}}, and I think there's a fit.\n\n{{offer_line}}\n\nNo pitch deck, no pressure. If a 15-minute conversation this week sounds worthwhile, {{slots_or_reply}}.\n\n${SIGN}`,
    requires: [...B2B_REQ, "offer_line"] },
  { key: "intro_b2b_formal", name: "Business intro — formal", category: "intro_b2b", tone: "formal", audience: "business", description: "For professional services and larger firms.", approvedAt: "2026-10-12",
    subject: "Introduction: {{sender_company}} for {{company}}",
    body: `{{greeting}}\n\nMy name is {{sender_name}} and I lead {{sender_company}}{{sender_category_phrase}}{{city_phrase}}. I'm writing because {{company}} is the kind of {{category_or_business}} we work with regularly, and I'd value a brief conversation.\n\n{{offer_line}}\n\nIf it would be helpful, I can hold fifteen minutes this week at your convenience — {{slots_or_reply}}.\n\nKind regards,\n${SIGN}`,
    requires: [...B2B_REQ, "offer_line"] },

  // ---- SFB Connect's own outreach (team-only; Rome's exact words, approved 2026-10-19) ----
  { key: "sfb_roofing_missed_calls", name: "SFB — Roofing missed calls (Rome)", category: "intro_b2b", tone: "direct", audience: "business", teamOnly: true,
    description: "Rome's roofing pilot intro: missed calls while crews are on roofs → AI team answers, qualifies, books, asks for reviews. Needs the company's city; adds \"for X years\" only when a years-in-business column was uploaded.", approvedAt: "2026-10-19",
    subject: "{{company}} + missed calls",
    body: `Hi {{company}} team,\n\nSaw {{company}}'s been serving {{city}}{{years_phrase}} — solid reputation.\n\nQuick question: when your crews are on roofs, who picks up the calls your office misses?\n\nI'm Rome with SFB Connect. We set roofing companies up with an AI team that answers every missed call, qualifies the homeowner, and books the job straight to your calendar — plus automated review requests after every job.\n\nWorth 15 minutes next week? I'll show you exactly what it'd do for {{company}}.\n\nBest,\nRome Royce\nFounder, SFB Connect\nsfbconnect.com`,
    requires: ["company", "city"] },

  // ---- Intro — consumer (the person is the prospect; {{company}} is their name, so it is never used) ----
  { key: "intro_b2c", name: "Consumer intro — plain", category: "intro_b2c", tone: "plain", audience: "consumer", description: "Person-to-person. Opt-out up front, one clear offer, one ask.", approvedAt: "2026-10-12",
    subject: "A quick note from {{sender_name}} at {{sender_company}}",
    body: `{{greeting_person}}\n\nI'm {{sender_name}} and I run {{sender_company}}{{sender_category_phrase}}{{city_phrase}}. This is a personal note, not a blast — if it's not for you, a one-word "no thanks" is all it takes.\n\n{{offer_line}}\n\nIf it sounds useful, I can hold a 15-minute slot this week — {{slots_or_reply}}. No pressure either way.\n\n${SIGN}`,
    requires: [...B2C_REQ, "offer_line"] },
  { key: "intro_b2c_warm", name: "Consumer intro — warm", category: "intro_b2c", tone: "warm", audience: "consumer", description: "Neighbourly; good for home services and local trades.", approvedAt: "2026-10-12",
    subject: "Hello from {{sender_company}}{{city_phrase}}",
    body: `{{greeting_person}}\n\n{{sender_name}} here, from {{sender_company}}{{city_phrase}}. I'll keep this short: we're a local {{sender_category_or_business}} and I'd rather introduce myself properly than let an ad do it.\n\n{{offer_line}}\n\nIf you'd like to talk it through, I can hold 15 minutes this week — {{slots_or_reply}}. If not, no hard feelings and you won't hear from me again.\n\n${SIGN}`,
    requires: [...B2C_REQ, "offer_line"] },
  { key: "intro_b2c_direct", name: "Consumer intro — direct", category: "intro_b2c", tone: "direct", audience: "consumer", description: "Shortest version. The offer, the ask, done.", approvedAt: "2026-10-12",
    subject: "{{sender_company}} — one question",
    body: `{{greeting_person}}\n\n{{sender_name}} from {{sender_company}}. One question and I'll get out of your inbox:\n\n{{offer_line}}\n\nWorth 15 minutes this week? {{slots_or_reply_cap}}. A "no" is a perfectly good answer too.\n\n${SIGN}`,
    requires: [...B2C_REQ, "offer_line"] },

  // ---- Follow-ups (business wording = the originals; consumer variants never say {{company}}) ----
  { key: "follow_up_1", name: "Follow-up 1 (business)", category: "follow_up", tone: "plain", audience: "business", description: "Day 3. Gentle nudge, easy out.", approvedAt: "2026-10-11",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}\n\nFollowing up on my note from earlier this week. No pressure — if the timing is wrong, a one-word "later" is a perfectly good answer.\n\nIf it's right, {{slots_or_reply}}.\n\n{{sender_name}}`,
    requires: B2B_REQ },
  { key: "follow_up_2", name: "Follow-up 2 (business)", category: "follow_up", tone: "plain", audience: "business", description: "Day 7. Last note, door open.", approvedAt: "2026-10-11",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}\n\nLast note from me. If {{company}} ever wants a second set of hands on {{sender_category_or_this}}, my door's open.\n\n${SIGN}`,
    requires: B2B_REQ },
  { key: "follow_up_3", name: "Follow-up 3 (business) — the useful one", category: "follow_up", tone: "warm", audience: "business", description: "Optional extra step: give something before asking again.", approvedAt: "2026-10-12",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}\n\nOne more, and it's not a nudge: if it's useful, I'm happy to send over the two or three things we'd look at first for a {{category_or_business}} like {{company}} — no call required, no strings.\n\nJust reply "send it" and I will.\n\n{{sender_name}}`,
    requires: B2B_REQ },
  { key: "follow_up_b2c_1", name: "Follow-up 1 (consumer)", category: "follow_up", tone: "plain", audience: "consumer", description: "Day 3, person-to-person.", approvedAt: "2026-10-12",
    subject: "Re: A quick note from {{sender_name}} at {{sender_company}}",
    body: `{{greeting_person}}\n\nFollowing up on my note from earlier this week. No pressure — if the timing's wrong, "later" is a perfectly good answer.\n\nIf it's right, {{slots_or_reply}}.\n\n{{sender_name}}`,
    requires: B2C_REQ },
  { key: "follow_up_b2c_2", name: "Follow-up 2 (consumer)", category: "follow_up", tone: "plain", audience: "consumer", description: "Day 7, last note.", approvedAt: "2026-10-12",
    subject: "Re: A quick note from {{sender_name}} at {{sender_company}}",
    body: `{{greeting_person}}\n\nLast note from me. If you ever want a hand with {{sender_category_or_this}}, my door's open.\n\n${SIGN}`,
    requires: B2C_REQ },

  // ---- Re-engagement ----
  { key: "re_engagement", name: "Re-engagement — it's been a while", category: "re_engagement", tone: "warm", audience: "any", description: "For someone who replied once or booked and went quiet. Weeks or months later.", approvedAt: "2026-10-12",
    subject: "Picking this back up — {{sender_company}}",
    body: `{{greeting_any}}\n\nIt's been a while since we last spoke, and I didn't want to let it go quiet without checking in. Things change — budgets, seasons, priorities — so no assumptions on my side.\n\n{{offer_line}}\n\nIf now is a better time, I can hold 15 minutes this week — {{slots_or_reply}}. If it's still not the moment, just say so and I'll check back in a few months.\n\n${SIGN}`,
    requires: [...B2C_REQ, "offer_line"] },

  // ---- Booking nudge ----
  { key: "booking_nudge", name: "Booking nudge — you said yes, let's lock it", category: "booking_nudge", tone: "friendly", audience: "any", description: "They showed interest but haven't picked a time.", approvedAt: "2026-10-12",
    subject: "Re: {{sender_company}} — picking a time",
    body: `{{greeting_any}}\n\nThanks for the interest — I'd like to make the call easy. Here are a few times that work on my side — {{slots}} — or send one that suits you and I'll fit around it.\n\n15 minutes, no slides, just a straight conversation about whether this is a fit.\n\n{{sender_name}}`,
    requires: [...B2C_REQ, "slots"] },

  // ---- Review + testimonial requests (to existing customers) ----
  { key: "review_request", name: "Review request", category: "review_request", tone: "friendly", audience: "any", description: "Ask a happy customer for a public review. Honest ask, one link.", approvedAt: "2026-10-12",
    subject: "A small favour from {{sender_company}}",
    body: `{{greeting_any}}\n\nThank you for working with {{sender_company}} — it genuinely means a lot to a {{sender_category_or_business}} like ours.\n\nIf you were happy with how things went, would you take two minutes to leave us a review? It helps the next person find us, and it helps us keep doing this. {{review_link_line}}\n\nIf anything wasn't right, please reply to this email instead and tell me directly — I'd rather fix it than ask for a review.\n\n${SIGN}`,
    requires: B2C_REQ },
  { key: "testimonial_request", name: "Testimonial request", category: "testimonial_request", tone: "warm", audience: "any", description: "Ask for a quote you can publish, with their permission.", approvedAt: "2026-10-12",
    subject: "Could I quote you? — {{sender_company}}",
    body: `{{greeting_any}}\n\nI'm putting together a few words from people we've worked with, and yours would carry weight. Would you be willing to share two or three sentences about your experience with {{sender_company}}?\n\nAnything honest is perfect — what the problem was, what changed. I'll send you exactly how it would appear before anything is published, and you can edit or pull it at any time.\n\nThank you either way.\n\n${SIGN}`,
    requires: B2C_REQ },

  // ---- System (used by the engine, not offered in the picker) ----
  { key: "reply_thanks", name: "Reply — thanks + times", category: "system", tone: "plain", audience: "any", description: "Agent's reply when a prospect answers.", approvedAt: "2026-10-11",
    subject: "Re: {{sender_company}} × {{company}}",
    body: `{{greeting}}\n\nThanks for getting back to me. Here are a few times that work on my side — {{slots}} — or send one that suits you and I'll fit around it.\n\n{{sender_name}}`,
    requires: [...B2B_REQ, "slots"] },
  { key: "booking_confirmation", name: "Booking confirmation", category: "system", tone: "plain", audience: "any", description: "Sent (after approval) when a meeting is booked.", approvedAt: "2026-10-11",
    subject: "Confirmed: {{sender_company}} × {{company}} — {{booking_time}}",
    body: `{{greeting}}\n\nLocked in: {{booking_time}}.{{meet_line}}\n\nTalk soon,\n${SIGN}`,
    requires: [...B2B_REQ, "booking_time"] },
];

export const presetByKey = (key: string) => PRESETS.find((p) => p.key === key) ?? null;
/** Presets the picker shows (system ones are engine-only). */
export const LIBRARY = PRESETS.filter((p) => p.category !== "system");
/** Presets every business sees (team-only SFB copy removed). */
export const PUBLIC_LIBRARY = LIBRARY.filter((p) => !p.teamOnly);

/** Follow-up steps swap to the consumer wording when the chosen intro is consumer-facing. */
export function resolveStepTemplate(stepTemplate: string, introKey: string): string {
  if (stepTemplate === "intro") return introKey;
  const intro = presetByKey(introKey);
  if (intro?.audience === "consumer") { if (stepTemplate === "follow_up_1") return "follow_up_b2c_1"; if (stepTemplate === "follow_up_2") return "follow_up_b2c_2"; }
  return stepTemplate;
}

const CONSUMER_WORDS = /\b(homeowner|home ?owner|resident|tenant|renter|patient|parent|famil(y|ies)|consumer|individual|household|buyer|driver|senior|retiree|student|member|customer)s?\b/i;

/** Deterministic recommendation: consumer when the uncontacted list is mostly people (uploaded rows with no website where the person is the prospect) or the ICP reads consumer. Never guesses beyond that. */
export function recommendIntro(prospects: { source?: string | null; website?: string | null; contact_name?: string | null; name: string }[], icp: { industries?: string[]; notes?: string | null } | null): { key: "intro" | "intro_b2c"; reason: string } {
  const people = prospects.filter((p) => !p.website && p.contact_name && p.contact_name === p.name).length;
  if (prospects.length > 0 && people / prospects.length > 0.5) return { key: "intro_b2c", reason: `${people} of ${prospects.length} on your list are people, not companies (uploaded rows with no business or website).` };
  const icpText = [...(icp?.industries ?? []), icp?.notes ?? ""].join(" ");
  if (CONSUMER_WORDS.test(icpText)) return { key: "intro_b2c", reason: `Your ideal customer reads like a consumer audience ("${icpText.match(CONSUMER_WORDS)?.[0]}").` };
  return { key: "intro", reason: prospects.length ? "Your list is businesses — the business intro fits." : "Your ideal customer is other businesses — the business intro fits." };
}
