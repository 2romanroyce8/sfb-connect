// ============================================================
// SFB AGENT — SINGLE SOURCE OF TRUTH
// Capabilities, tiers, every per-action credit price, top-up packs and the
// planning math all live here. The public price list, the checkout, the
// ledger guards and the dashboard all render from this file, so there is
// exactly one place for a number to change and no way for them to drift.
// Capability STATUSES (live / unlocking next / roadmap) are data in
// agent_program_modules because they change without a deploy.
// ============================================================

export type ModuleStatus = "live" | "unlocking_next" | "roadmap";
export const STATUS_LABEL: Record<ModuleStatus, string> = { live: "Live now", unlocking_next: "Unlocking next", roadmap: "On the roadmap" };
export const STATUS_COLOR: Record<ModuleStatus, string> = { live: "#30D158", unlocking_next: "#FFD60A", roadmap: "#8E8E93" };

// ---- The 8 capabilities (owner toggles; tiers never gate access) ----
export const CAPABILITIES = [
  { key: "ai_presence", name: "AI Presence", short: "Recommended by ChatGPT, Perplexity, Gemini, Claude" },
  { key: "outbound_gtm", name: "Outbound / GTM", short: "Finds buyers, enriches, writes, follows up, books calls" },
  { key: "meta_ads", name: "Meta Ads", short: "Managed for ROAS: creative testing, retargeting, full-funnel" },
  { key: "website", name: "Website", short: "Homepage, speed, payments, backlinks, SEO" },
  { key: "crm_automations", name: "CRM + Automations", short: "Pipeline, follow-up, reminders, missed-call textback" },
  { key: "chat_texting", name: "Chat & Texting", short: "Website chat + SMS agent that qualifies and books" },
  { key: "reviews_reputation", name: "Reviews & Reputation", short: "Generation, monitoring, responses" },
  { key: "sops", name: "SOPs", short: "Operations documentation" },
] as const;
export type CapabilityKey = (typeof CAPABILITIES)[number]["key"];
export const CAPABILITY_KEYS = CAPABILITIES.map((c) => c.key) as CapabilityKey[];
export const capability = (key: string) => CAPABILITIES.find((c) => c.key === key) ?? null;

// ---- Tiers ----
export const TIERS = [
  { key: "trial", name: "Trial", monthlyUsd: 0, onboardingUsd: 0, credits: 128, creditsLabel: "128 one-time", businesses: 1, businessesLabel: "1 demo on stock data", capabilityLimit: 3, capabilitiesLabel: "Pick 3 to watch", integrations: "None (sandbox)", overseer: "—", priceListVisible: false, expiry: "0 credits or 3 days", trialDays: 3 },
  { key: "solo", name: "Solo", monthlyUsd: 1497, onboardingUsd: 1497, credits: 150, creditsLabel: "150 / month", businesses: 1, businessesLabel: "1 real business", capabilityLimit: 8, capabilitiesLabel: "All 8", integrations: "GHL, Zapier, Calendar, Gmail, Meta, Stripe", overseer: "Shared", priceListVisible: true, expiry: "Monthly", featured: true },
  { key: "agency", name: "Agency", monthlyUsd: 4997, onboardingUsd: 4997, credits: 500, creditsLabel: "500 / month pooled", businesses: 5, businessesLabel: "5 white-labeled client spaces", capabilityLimit: 8, capabilitiesLabel: "All 8 per space", integrations: "Same per space", overseer: "Dedicated", priceListVisible: true, expiry: "Monthly" },
] as const;
export type Tier = (typeof TIERS)[number];
export type TierKey = Tier["key"];
export const tier = (key: string | null | undefined): Tier | null => TIERS.find((t) => t.key === key) ?? null;
export const PAID_TIERS = TIERS.filter((t) => t.monthlyUsd > 0);

// ---- Credit price list (one credit type) ----
export type CreditAction = { key: string; label: string; credits: number; capability: CapabilityKey | "human" };
export const CREDIT_PRICES: CreditAction[] = [
  { key: "presence.listing_fix", label: "Listing fix", credits: 1, capability: "ai_presence" },
  { key: "presence.score_refresh", label: "Score refresh", credits: 2, capability: "ai_presence" },
  { key: "presence.content_brief", label: "Content brief", credits: 5, capability: "ai_presence" },
  { key: "presence.competitor_analysis", label: "Competitor analysis", credits: 10, capability: "ai_presence" },
  { key: "presence.market_analysis", label: "Market analysis", credits: 15, capability: "ai_presence" },
  { key: "presence.location_optimization", label: "Location optimization", credits: 15, capability: "ai_presence" },
  { key: "outbound.prospect_sourced", label: "Prospect sourced", credits: 1, capability: "outbound_gtm" },
  { key: "outbound.prospect_enriched", label: "Prospect enriched", credits: 2, capability: "outbound_gtm" },
  { key: "outbound.message_written", label: "Message written", credits: 2, capability: "outbound_gtm" },
  { key: "outbound.reply_drafted", label: "Reply drafted", credits: 2, capability: "outbound_gtm" },
  { key: "outbound.meeting_booked", label: "Meeting booked", credits: 5, capability: "outbound_gtm" },
  { key: "outbound.sequence_built", label: "Sequence built", credits: 15, capability: "outbound_gtm" },
  { key: "ads.creative", label: "Ad creative", credits: 5, capability: "meta_ads" },
  { key: "ads.audience", label: "Audience built", credits: 5, capability: "meta_ads" },
  { key: "ads.optimization_pass", label: "Optimization pass", credits: 10, capability: "meta_ads" },
  { key: "ads.campaign_launch", label: "Campaign launch", credits: 25, capability: "meta_ads" },
  { key: "website.tweak", label: "Site tweak", credits: 5, capability: "website" },
  { key: "website.landing_page", label: "Landing page", credits: 15, capability: "website" },
  { key: "website.full_build", label: "Full website build", credits: 100, capability: "website" },
  { key: "backend.automation", label: "Automation built", credits: 10, capability: "crm_automations" },
  { key: "backend.pipeline_setup", label: "Pipeline setup", credits: 25, capability: "crm_automations" },
  { key: "backend.qa_pass", label: "QA pass", credits: 5, capability: "crm_automations" },
  { key: "chat.turn", label: "Chat turn", credits: 1, capability: "chat_texting" },
  { key: "chat.booking", label: "Booking made", credits: 3, capability: "chat_texting" },
  { key: "chat.handoff", label: "Human handoff", credits: 2, capability: "chat_texting" },
  { key: "reviews.request", label: "Review request", credits: 1, capability: "reviews_reputation" },
  { key: "reviews.response", label: "Review response", credits: 2, capability: "reviews_reputation" },
  { key: "reviews.sentiment_report", label: "Sentiment report", credits: 5, capability: "reviews_reputation" },
  { key: "sops.update", label: "SOP update", credits: 5, capability: "sops" },
  { key: "sops.library_doc", label: "SOP library document", credits: 25, capability: "sops" },
  { key: "human.review_pass", label: "Human review pass", credits: 5, capability: "human" },
  { key: "human.verification", label: "Human verification", credits: 15, capability: "human" },
];
export const creditPrice = (actionKey: string) => CREDIT_PRICES.find((p) => p.key === actionKey) ?? null;
export const FREE_ACTIONS = ["Sends", "Report views", "Logins", "Capability toggles"] as const;

// ---- Planning math (published) ----
export const CREDITS_PER_BOOKED_CALL = 15;
export const bookedCallsFor = (credits: number) => Math.floor(credits / CREDITS_PER_BOOKED_CALL);

// ---- Top-ups: never expire while membership is active; monthly allotment spends first and never rolls over ----
export const TOP_UP_PACKS = [
  { name: "100 Credits", credits: 100, usd: 149 },
  { name: "500 Credits", credits: 500, usd: 599 },
  { name: "1,000 Credits", credits: 1000, usd: 999 },
] as const;

// ---- Guards ----
export const WARN_AT = 0.8;   // email + banner
export const CRITICAL_AT = 0.95;
export const CREDITS_PAY_FOR_WORK = "Credits pay for work done, not outcomes. Failed work costs 0.";

// ---- Trial sandbox: stock business profiles (fake data, no real sends) ----
export const STOCK_PROFILES = [
  { key: "roofing_tampa", name: "Sample Roofing Co.", city: "Tampa", state: "FL", category: "Roofing Contractor", website: "https://sampleroofing.example", prospects: ["Bayshore Property Mgmt", "Westchase HOA", "Harbor Island Condos"], reviews: 4.6 },
  { key: "dental_austin", name: "Bright Smile Dental", city: "Austin", state: "TX", category: "Dentist", website: "https://brightsmile.example", prospects: ["Mueller Family Clinic referral", "Domain Northside employers", "Travis County Teachers plan"], reviews: 4.8 },
  { key: "hvac_denver", name: "Peak Comfort HVAC", city: "Denver", state: "CO", category: "HVAC Contractor", website: "https://peakcomfort.example", prospects: ["Cherry Creek Apartments", "RiNo Restaurant Group", "Stapleton Builders"], reviews: 4.5 },
  { key: "medspa_scottsdale", name: "Glow Aesthetics Med Spa", city: "Scottsdale", state: "AZ", category: "Medical Spa", website: "https://glowaesthetics.example", prospects: ["Kierland Commons retailers", "Fashion Square concierge", "Gainey Ranch HOA"], reviews: 4.9 },
] as const;
export type StockProfile = (typeof STOCK_PROFILES)[number];
export const stockProfile = (key: string | null | undefined) => STOCK_PROFILES.find((p) => p.key === key) ?? null;

export const DEMO_HREF = "/start"; // the demo form left the homepage 2026-10-09; the trial is the demo
export const PRICING_NOTE = "Pricing shown is for roofing. Clinics and private equity are priced by consultation.";
export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

// ---- Billing intervals (pricing page overhaul, Roman spec 2026-10-10) ----
// Annual = ANNUAL_MONTHS_CHARGED × monthly, billed once a year (2 months free).
// The setup fee is one-time and is NEVER discounted. Credits still refill
// monthly on annual plans (see lib/agentProgram/provision.ts refillAnnualPlans).
export type BillingInterval = "month" | "year";
export const ANNUAL_MONTHS_CHARGED = 10;
export const annualUsd = (monthlyUsd: number) => monthlyUsd * ANNUAL_MONTHS_CHARGED;
export const annualPerMonthUsd = (monthlyUsd: number) => Math.round((annualUsd(monthlyUsd) / 12) * 100) / 100;

// ---- Niche multipliers: roofing is the price shown; the others are quoted by consultation ----
export const NICHES = [
  { key: "roofing", name: "Roofing", multiplier: 1.0, shown: true },
  { key: "clinics", name: "Clinics", multiplier: 1.5, shown: false },
  { key: "private_equity", name: "Private equity", multiplier: 3.0, shown: false },
] as const;
export const nicheUsd = (usd: number, multiplier: number) => Math.round(usd * multiplier);

// ---- BLANKS — only Rome fills these. NEVER invent. ----
// While a value is null the UI renders nothing for it: no strikethrough, no
// "Launch pricing" tag, no vendor total figure (the fallback copy is the one
// Rome offered: "thousands").
export const LAUNCH_PRICING_TAG = "Launch pricing";
export const ANCHOR_WAS_USD: Record<"solo" | "agency", number | null> = { solo: null, agency: null };
export const REPLACED_VENDORS: { name: string; monthlyUsd: number | null }[] = [
  { name: "SEO agency", monthlyUsd: null },
  { name: "Ad manager", monthlyUsd: null },
  { name: "Web designer", monthlyUsd: null },
  { name: "CRM consultant", monthlyUsd: null },
  { name: "Answering service", monthlyUsd: null },
  { name: "Ops consultant", monthlyUsd: null },
];
export const VENDORS_TOTAL_MONTHLY_USD: number | null = null;

// Pricing-page FAQ (10). Final copy — Atlas copy pack 2026-10-09.
export const AGENT_FAQ = [
  { q: "What's included in the monthly price?", a: "Your SFB Agent, all eight capabilities, your monthly credit allotment, your named human overseer, integrations with your tools, daily/weekly/monthly reports, and your dashboard. No seat fees, no contracts." },
  { q: "Do unused credits roll over?", a: "Monthly plan credits reset each billing cycle — they don't roll over. Top-up packs are different: purchased credits never expire while your membership is active." },
  { q: "Is there really a free trial?", a: "Yes. The Trial is free: 128 credits on a demo business with stock data — no card required, no charge at the end. You pick a demo business, choose three capabilities to watch, and see credits being spent as the agent works. No real integrations, no real sends. Upgrade whenever you're ready." },
  { q: "What happens when I run out of credits?", a: "You get a warning email at 80% usage. At zero, the agent pauses — never overcharges. Top up (100/$149, 500/$599, 1,000/$999) or wait for your monthly refill." },
  { q: "Do I pay for work that fails?", a: "No. Failed work — errors, bounces, no result — costs zero credits, always." },
  { q: "Can I get a refund?", a: "Months and credit packs are non-refundable — the work happened. Cancel anytime; your plan runs to the end of the paid period." },
  { q: "Will prices change?", a: "Possible, as the product grows. Any change is posted here before it takes effect." },
  { q: "What if the agent doesn't get results?", a: "Credits pay for work performed — not guaranteed calls, rankings, leads, or revenue. Your reports show exactly what the agent did and what it cost. If it's not working for you, cancel anytime." },
  { q: "Can I change capabilities mid-month?", a: "Yes. Toggles are instant, anytime, at no cost. Turn a capability off and the agent stops spending on it immediately." },
  { q: "Who is the human overseer?", a: "A named expert on our team assigned to your account. They approve anything customer-facing before it runs and sign every report. You set who it is in Settings → Team." },
] as const;
