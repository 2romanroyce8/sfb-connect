
// Profile confirmed on the build-show review screen (funnel step 3).

export type DemoProfile = {
  businessName: string; contactName: string; website: string; domain: string;
  category: string | null; nicheTags: string[]; city: string | null; state: string | null; phone: string;
  services: string[]; offerLine: string; socials: Record<string, string>; logoUrl: string | null; toneNotes: string[];
};

export class DemoError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); } }

const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const US_STATE = /^[A-Z]{2}$/;

/** Validates the review-screen payload. Required: business name, your name, phone, offer line. */
export function parseDemoProfile(b: Record<string, unknown>): { profile: DemoProfile } | { error: string } {
  const businessName = clean(b.businessName, 120); const contactName = clean(b.contactName, 80); const phone = clean(b.phone, 32); const offerLine = clean(b.offerLine, 180);
  const website = clean(b.website, 300); const domain = clean(b.domain, 200).toLowerCase();
  if (businessName.length < 2) return { error: "Enter your business name." };
  if (contactName.length < 2) return { error: "Enter your name — it signs the emails." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a phone number with at least 10 digits." };
  if (offerLine.length < 15) return { error: "Write your one-line offer (at least 15 characters) — every intro uses it." };
  if (!/^https?:\/\//.test(website) || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: "Website is missing." };
  const services = Array.from(new Set((Array.isArray(b.services) ? b.services : []).map((s) => clean(s, 60)).filter((s) => s.length >= 2))).slice(0, 20);
  const socialsIn = (b.socials && typeof b.socials === "object" ? b.socials : {}) as Record<string, unknown>;
  const socials: Record<string, string> = {};
  for (const [k, v] of Object.entries(socialsIn)) { const u = clean(v, 300); if (/^[a-z]{1,16}$/.test(k) && /^https?:\/\//.test(u)) socials[k] = u; }
  const state = clean(b.state, 2).toUpperCase();
  const logoUrl = clean(b.logoUrl, 500); const toneNotes = (Array.isArray(b.toneNotes) ? b.toneNotes : []).map((s) => clean(s, 80)).filter(Boolean).slice(0, 6);
  const nicheTags = Array.from(new Set((Array.isArray(b.nicheTags) ? b.nicheTags : []).map((t) => clean(t, 40).toLowerCase()).filter(Boolean))).slice(0, 4);
  return { profile: { businessName, contactName, website, domain, category: clean(b.category, 80) || null, nicheTags, city: clean(b.city, 80) || null, state: US_STATE.test(state) ? state : null, phone, services, offerLine, socials, logoUrl: /^https?:\/\//.test(logoUrl) ? logoUrl : null, toneNotes } };
}
