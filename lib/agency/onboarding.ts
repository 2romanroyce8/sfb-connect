// Onboarding intake definition + server-side validation (pure, client-safe). The form and the API both read FIELDS, so a key that isn't here can never be stored.
export type Field = { key: string; label: string; hint?: string; long?: boolean; required?: boolean; max: number };
export const SECTIONS: { title: string; fields: Field[] }[] = [
  { title: "Your business", fields: [
    { key: "legal_name", label: "Legal business name", required: true, max: 160 },
    { key: "website", label: "Website", hint: "https://…", max: 200 },
    { key: "contact_name", label: "Main contact name", required: true, max: 120 },
    { key: "contact_email", label: "Main contact email", required: true, max: 200 },
    { key: "contact_phone", label: "Main contact phone", max: 40 },
    { key: "approval_contact", label: "Who approves work on your side?", hint: "Name and email", max: 200 },
  ] },
  { title: "How you operate", fields: [
    { key: "hours", label: "Operating hours", long: true, required: true, max: 600 },
    { key: "services", label: "Services you offer", long: true, required: true, max: 1500 },
    { key: "pricing", label: "Pricing you want quoted (or how to answer price questions)", long: true, max: 1500 },
    { key: "policies", label: "Policies the AI must follow (cancellations, warranties, what never to promise)", long: true, max: 1500 },
  ] },
  { title: "Booking and leads", fields: [
    { key: "booking", label: "How should appointments be booked?", long: true, max: 800 },
    { key: "calendar_tool", label: "Calendar you use", hint: "Google Calendar, Outlook, other", max: 120 },
    { key: "crm_tool", label: "CRM or tools you use", max: 200 },
    { key: "lead_routing", label: "Who should new leads go to, and how fast?", long: true, max: 800 },
    { key: "phone_messaging", label: "Phone and messaging needs", hint: "Existing number? Texting needed?", long: true, max: 800 },
  ] },
  { title: "Anything else", fields: [
    { key: "notes", label: "Notes for the team", hint: "Do not put passwords here. We will connect your tools through secure sign-in links.", long: true, max: 2000 },
  ] },
];
export const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields);
export const KEYS = new Set(ALL_FIELDS.map((f) => f.key));

/** Keeps only known keys, trims and caps each value. Never throws. */
export function cleanAnswers(input: unknown): Record<string, string> {
  const out: Record<string, string> = {}; if (!input || typeof input !== "object") return out;
  for (const f of ALL_FIELDS) { const v = (input as Record<string, unknown>)[f.key]; if (typeof v === "string" && v.trim()) out[f.key] = v.trim().slice(0, f.max); }
  return out;
}
export function missingRequired(answers: Record<string, string>): string[] { return ALL_FIELDS.filter((f) => f.required && !answers[f.key]).map((f) => f.label); }
export function progress(answers: Record<string, string>): { done: number; total: number } {
  const req = ALL_FIELDS.filter((f) => f.required); return { done: req.filter((f) => answers[f.key]).length, total: req.length };
}
/** Warns (does not block) when a note looks like it contains a credential. */
export const looksLikeSecret = (s: string) => /(password|passcode|api[_ -]?key|secret|token)\s*[:=]\s*\S{4,}/i.test(s) || /\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]{8,}/.test(s);
