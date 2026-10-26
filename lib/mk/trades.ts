// Fictional demo businesses (client-safe). The voice route validates a trade KEY and builds the prompt server-side, so a visitor can never inject instructions.
export type Trade = { key: string; label: string; biz: string; service: string; city: string; asks: string[] };
export const TRADES: Trade[] = [
  { key: "hvac", label: "HVAC company", biz: "Northside Heating & Air", service: "an AC tune-up", city: "Tampa", asks: ["Do you do same-day repairs?", "How much is an AC tune-up?", "Can someone come this week?"] },
  { key: "dental", label: "Dental practice", biz: "Harbor Dental Studio", service: "a cleaning and exam", city: "Miami", asks: ["Are you taking new patients?", "How much is a cleaning?", "Can I get in this week?"] },
  { key: "roofing", label: "Roofing contractor", biz: "Summit Roofing Co", service: "a roof inspection", city: "Orlando", asks: ["Do you handle storm damage?", "How much is an inspection?", "Can someone come out this week?"] },
  { key: "medspa", label: "Med spa", biz: "Glow Aesthetics", service: "a facial consultation", city: "Fort Lauderdale", asks: ["What treatments do you offer?", "How much is a consultation?", "Do you have openings Saturday?"] },
  { key: "plumbing", label: "Plumbing company", biz: "Bayline Plumbing", service: "a leak inspection", city: "Jacksonville", asks: ["Do you take emergency calls?", "How much is a leak inspection?", "Can someone come today?"] },
];
export const tradeByKey = (k: unknown) => TRADES.find((t) => t.key === k) ?? null;
