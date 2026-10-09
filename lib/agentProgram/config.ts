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
  { key: "trial", name: "Trial", monthlyUsd: 0, onboardingUsd: 0, credits: 128, creditsLabel: "128 one-time", businesses: 1, businessesLabel: "1 demo on stock data", capabilityLimit: 3, capabilitiesLabel: "Pick 3 to watch", integrations: "None (sandbox)", overseer: "—", priceListVisible: false, expiry: "0 credits or 14 days", trialDays: 14 },
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

export const DEMO_HREF = "/#book-a-demo";
export const PRICING_NOTE = "Month-to-month · cancel anytime · no contracts. Pricing shown for roofing; clinics and private equity priced on consultation.";
export const fmtUsd = (n: number) => `$${n.toLocaleString("en-US")}`;

// Pricing-page FAQ (10). Placeholder answers written by engineering; marketing copy replaces them.
export const AGENT_FAQ = [
  { q: "What's included?", a: "One agent assigned to your business, all eight capabilities as they ship (you choose which run), a human overseer who approves anything customer-facing, your monthly credits, and a dashboard where you watch every action and its receipt." },
  { q: "Do unused credits roll over?", a: "Monthly credits reset each billing cycle and spend first. Top-up packs never expire while your membership is active." },
  { q: "What happens on the trial when credits hit zero?", a: "Work pauses and the dashboard shows the Solo and Agency plans. Reports and everything already done stay visible. The trial also ends 14 days after it starts." },
  { q: "What if the agent's work fails?", a: "Failed work costs 0 credits. You only pay for completed work." },
  { q: "Refunds?", a: "Credits pay for work done, not outcomes, so completed work isn't refunded. Monthly plans cancel anytime and you keep access through the paid period." },
  { q: "Will prices change?", a: "The credit price list is published on this page and in your dashboard. If it changes, you see the new list before any new work is charged." },
  { q: "Do you guarantee results?", a: "No. AI recommendations, ad performance and booking rates depend on your market and offer. We publish the planning math so you can see what your credits buy; we don't promise outcomes." },
  { q: "Can I switch capabilities on and off?", a: "Yes, any time, free. Toggles never cost credits. On the trial you watch 3 capabilities; paid tiers run all 8." },
  { q: "Who is the human overseer?", a: "A named SFB Connect team member assigned to your account. They approve anything customer-facing before it goes out and sign every report. Solo accounts share an overseer; Agency accounts get a dedicated one." },
  { q: "Can I cancel?", a: "Yes, month-to-month, no contracts. Your data and reports stay exportable." },
] as const;
