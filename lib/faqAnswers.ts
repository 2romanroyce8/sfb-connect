/**
 * Homepage "Ask anything else" answer bank. Pure, no backend, no AI: a fixed
 * list of answers matched by keywords. If nothing matches, the visitor is told
 * so and pointed to the trial — we never invent an answer.
 *
 * Every number here must agree with lib/agentProgram/config.ts; the test in
 * tests/lib/faqAnswers.test.ts pins the ones that can drift.
 */
import { CREDITS_PER_BOOKED_CALL, TIERS, TOP_UP_PACKS, fmtUsd } from "@/lib/agentProgram/config";

const solo = TIERS.find((t) => t.key === "solo")!;
const agency = TIERS.find((t) => t.key === "agency")!;
const trial = TIERS.find((t) => t.key === "trial")!;
const packs = TOP_UP_PACKS.map((p) => `${p.credits.toLocaleString("en-US")} for ${fmtUsd(p.usd)}`).join(", ");

export type FaqAnswer = { key: string; title: string; keywords: string[]; answer: string };

export const ANSWER_BANK: FaqAnswer[] = [
  { key: "price", title: "Pricing", keywords: ["price", "pricing", "cost", "how much", "monthly", "month", "annual", "yearly", "plan", "plans", "solo", "agency", "expensive", "cheap", "fee", "fees", "setup", "onboarding"],
    answer: `Three tiers. Trial is free (${trial.credits} one-time credits on a demo business). Solo is ${fmtUsd(solo.monthlyUsd)}/month plus a one-time ${fmtUsd(solo.onboardingUsd)} onboarding fee, with ${solo.credits} credits a month for one real business. Agency is ${fmtUsd(agency.monthlyUsd)}/month plus a one-time ${fmtUsd(agency.onboardingUsd)} onboarding fee, with ${agency.credits} pooled credits a month across five client spaces. Month-to-month, no contracts.` },
  { key: "trial", title: "Free trial", keywords: ["trial", "free", "demo", "try", "test", "sample", "card", "credit card", "no card", "start"],
    answer: `Yes, the Trial is free: ${trial.credits} credits on a demo business with stock data, no card required, no charge at the end. You pick a sample business, choose three capabilities to watch, and see credits being spent as the agent works. No real integrations or real sends on the trial. Start at /start.` },
  { key: "credits", title: "How credits work", keywords: ["how do credits", "credits work", "what are credits", "ledger", "receipt", "receipts", "charge", "charged", "metered", "per action", "price list", "how many credits"],
    answer: `Your agent runs on credits. Every task has a public per-action price: simple tasks cost little, big builds cost more, and you always see the receipt. One listing fix is 1 credit, one ad creative is 5, and a fully worked booked-call motion is about ${CREDITS_PER_BOOKED_CALL}. Sending messages, viewing reports and toggling capabilities cost nothing. The full price list is on the SFB Agent page.` },
  { key: "zero", title: "Running out of credits", keywords: ["zero", "run out", "out of credits", "pause", "paused", "overage", "overcharge", "surprise", "80%", "warning", "refill", "top up", "top-up", "topup", "pack", "packs", "buy more"],
    answer: `You get a warning email at 80% usage. At zero the agent pauses: you are never charged beyond what you bought and the ledger never goes negative. Top up (${packs}) or wait for your monthly refill. Monthly credits reset each cycle; top-up packs never expire while your membership is active.` },
  { key: "rollover", title: "Rollover", keywords: ["roll over", "rollover", "unused", "expire", "expiry", "carry"],
    answer: "Monthly plan credits reset each billing cycle and don't roll over. Top-up packs are different: purchased credits never expire while your membership is active." },
  { key: "failed", title: "Failed work", keywords: ["fail", "fails", "failed", "error", "bounce", "bounced", "no result", "mistake", "wrong", "bad output"],
    answer: "No. Failed work (errors, bounces, no result) costs zero credits, always. Completed work consumes credits even if you don't love the output; that is what the human overseer and the approval step are for." },
  { key: "refund", title: "Refunds", keywords: ["refund", "refunds", "money back", "chargeback", "guarantee money"],
    answer: "Months and credit packs are non-refundable because the work happened. You can cancel anytime and your plan runs to the end of the paid period." },
  { key: "cancel", title: "Cancelling", keywords: ["cancel", "cancellation", "contract", "contracts", "lock", "commitment", "quit", "leave", "stop"],
    answer: "Monthly plans cancel anytime, no contracts, no sales call required. Your plan stays active through the end of the paid period, and your data and reports stay exportable." },
  { key: "overseer", title: "The human overseer", keywords: ["overseer", "human", "person", "who", "team", "expert", "approve", "approval", "review", "oversight", "supervise"],
    answer: "A named expert on our team assigned to your account. They review your agent's work, approve anything customer-facing before it goes out, and sign every report. The agent does the work; the human makes sure it's right. Solo accounts share an overseer; Agency accounts get a dedicated one." },
  { key: "capabilities", title: "The eight capabilities", keywords: ["capabilit", "capabilities", "feature", "features", "what does it do", "jobs", "eight", "8", "toggle", "toggles", "turn on", "turn off", "switch"],
    answer: "Eight capabilities you toggle on or off: AI Presence, Outbound / go-to-market, Meta ads, Website, CRM + automations, Chat & texting, Reviews & reputation, and SOPs. Toggles are instant, free, and you can change them anytime. Your plan sets credits and human support, never which jobs the agent can do." },
  { key: "which", title: "Which capabilities to start with", keywords: ["which", "recommend", "should i", "best to start", "where to start", "first"],
    answer: "Start with the pain. No pipeline? Outbound. Losing leads after the click? Chat and CRM. Invisible when customers ask AI? AI Presence. Your overseer recommends the mix on onboarding; you make the final call." },
  { key: "ai_presence", title: "AI Presence", keywords: ["ai presence", "presence", "chatgpt", "claude", "perplexity", "gemini", "grok", "ai search", "found by ai", "ranking", "rankings", "visible", "visibility", "seo", "score", "audit"],
    answer: "AI Presence is how clearly ChatGPT, Claude, Perplexity, Gemini, Grok and AI-powered search understand and recommend your business. It overlaps with technical SEO but focuses on how your business information is structured and represented for AI systems. We don't guarantee rankings or citations; we publish exactly what the agent did and what it cost." },
  { key: "results", title: "Results and guarantees", keywords: ["result", "results", "guarantee", "guaranteed", "promise", "roi", "leads", "revenue", "work for me", "proof", "case study", "case studies", "testimonial"],
    answer: "We don't guarantee calls, rankings, leads or revenue. Credits pay for work performed, and your reports show exactly what the agent did and what it cost. If it isn't working for you, cancel anytime." },
  { key: "integrations", title: "Integrations", keywords: ["integrat", "integration", "integrations", "gohighlevel", "ghl", "zapier", "calendar", "gmail", "meta", "facebook", "instagram", "stripe", "crm", "webhook", "connect", "tools"],
    answer: "Paid tiers connect to GoHighLevel, Zapier, Google Calendar, Gmail, Meta and Stripe, plus webhooks. The agent acts inside those accounts only within the tasks you approve. The trial has no real integrations." },
  { key: "outbound", title: "Outbound", keywords: ["outbound", "cold", "prospect", "prospects", "booked call", "booked calls", "appointments", "gtm", "go-to-market", "email campaign", "sms"],
    answer: `Outbound sources and enriches prospects, writes messages and replies, and books meetings. Planning math: about ${CREDITS_PER_BOOKED_CALL} credits per fully worked booked call, so Solo's ${solo.credits} monthly credits are roughly ${Math.floor(solo.credits / CREDITS_PER_BOOKED_CALL)} fully worked prospects a month and Agency's ${agency.credits} about ${Math.floor(agency.credits / CREDITS_PER_BOOKED_CALL)}. Nothing is sent without human approval.` },
  { key: "ads", title: "Meta ads", keywords: ["ads", "ad", "meta ads", "facebook ads", "instagram ads", "campaign", "creative", "ad spend", "budget"],
    answer: "The Meta ads capability builds audiences and creatives, launches campaigns and runs optimization passes. Ad spend is paid to Meta from your own ad account; credits cover the agent's work, not the media. You remain the advertiser of record." },
  { key: "website", title: "Websites", keywords: ["website", "websites", "site", "landing page", "landing pages", "web design", "build my site"],
    answer: "The Website capability handles site tweaks, landing pages and full builds, priced per action on the public list (a full website build is 100 credits). Your overseer approves anything before it goes live." },
  { key: "reviews", title: "Reviews & reputation", keywords: ["review", "reviews", "reputation", "google reviews", "rating", "ratings", "sentiment"],
    answer: "Reviews & reputation sends review requests, drafts responses and produces sentiment reports. The agent never writes fake reviews and never posts a response without approval." },
  { key: "chat", title: "Chat & texting", keywords: ["chat", "chatbot", "texting", "text", "sms", "messages", "respond", "inbound", "booking"],
    answer: "Chat & texting answers inbound conversations, books appointments and hands off to a human when needed. A chat turn is 1 credit, a booking made is 3, a human handoff is 2." },
  { key: "sops", title: "SOPs", keywords: ["sop", "sops", "process", "processes", "documentation", "playbook", "playbooks", "training"],
    answer: "The SOPs capability writes and updates your standard operating procedures and playbooks (an SOP update is 5 credits, a library document 25). Playbooks and assets the agent produces for your business are yours to use." },
  { key: "who_for", title: "Who it's for", keywords: ["who is this for", "for me", "roofing", "roofer", "contractor", "contractors", "clinic", "clinics", "dental", "med spa", "private equity", "restaurant", "local business", "service business", "industry", "industries", "small business"],
    answer: "Local and service businesses: roofing and other contractors, home services, clinics and professional services. Pricing shown is for roofing; clinics and private equity are priced by consultation." },
  { key: "agency_plan", title: "Agency plan", keywords: ["white label", "white-label", "white labeled", "client spaces", "clients", "resell", "resale", "multiple businesses", "locations", "multi"],
    answer: `Agency is ${fmtUsd(agency.monthlyUsd)}/month with ${agency.credits} pooled credits across five white-labeled client spaces, all eight capabilities per space, and a dedicated overseer. Reselling the service outside those spaces requires written permission.` },
  { key: "time", title: "Speed and timeline", keywords: ["how long", "how fast", "timeline", "when", "soon", "quick", "days", "weeks", "turnaround", "setup time", "onboard"],
    answer: "The trial runs the moment you sign up. Paid onboarding starts with your overseer recommending a capability mix, connecting your tools and approving the first tasks; the agent works continuously from there and you see every action in the dashboard as it happens." },
  { key: "security", title: "Data and security", keywords: ["data", "privacy", "secure", "security", "safe", "password", "access", "sell my data", "gdpr", "ccpa"],
    answer: "Your business data stays yours. We use it only to run the service, never sell it, and the agent only touches connected accounts within tasks you approve. Our Privacy Policy and Terms are linked in the footer." },
  { key: "support", title: "Support and contact", keywords: ["support", "contact", "help", "talk", "call", "phone", "email you", "reach", "speak", "sales"],
    answer: "Every paid account has a named human overseer you can reach from your dashboard. Before you buy, the fastest way to see how it works is the free trial at /start; no sales call required." },
  { key: "login", title: "Signing in", keywords: ["login", "log in", "sign in", "dashboard", "account", "forgot password", "reset"],
    answer: "Customers sign in at /login (there is a Forgot password link there). Your dashboard shows your agent's activity, credit ledger, capability toggles and reports." },
  { key: "difference", title: "Agent vs. agency vs. software", keywords: ["different", "difference", "vs", "versus", "compared", "agency vs", "software", "saas", "tool", "replace", "employee", "hire"],
    answer: "It's one AI agent assigned to your business, doing the work across eight jobs, with a named human who approves anything customer-facing. You pay per action in credits instead of retainers or seats, you see every receipt, and you can turn any job off instantly." },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9%$ ]+/g, " ").replace(/\s+/g, " ").trim();

export type AskResult = { matched: FaqAnswer | null; answer: string };

export const NO_MATCH_ANSWER = "I don't have a set answer for that yet, so I won't guess. The fastest way to find out is the free trial at /start (no card, 128 credits on a demo business), where a human overseer can answer anything specific to your business.";

/** Keyword scoring: longer, more specific keywords outweigh short ones; ties go to earlier (more important) entries. */
export function answerQuestion(question: string): AskResult {
  const q = ` ${norm(question)} `;
  if (q.trim().length < 2) return { matched: null, answer: NO_MATCH_ANSWER };
  let best: { entry: FaqAnswer; score: number } | null = null;
  for (const entry of ANSWER_BANK) {
    let score = 0;
    for (const kw of entry.keywords) {
      const k = norm(kw);
      if (!k) continue;
      // Multi-word phrases are the strongest signal; then long words; short words least.
      if (q.includes(` ${k} `) || (k.length >= 6 && q.includes(k))) score += k.includes(" ") ? 5 : k.length >= 6 ? 3 : k.length >= 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best ? { matched: best.entry, answer: best.entry.answer } : { matched: null, answer: NO_MATCH_ANSWER };
}
