/**
 * Legal documents — single source of truth for /privacy and /terms.
 *
 * The text below is Atlas's FINAL copy pack of 2026-10-09 ("SFB Copy Pack
 * for HyperAgent"), transcribed faithfully. Engineering does not write legal
 * copy; it only wires it. Plan/credit numbers inside the Terms are generated
 * from lib/agentProgram/config.ts so the Terms always state what checkout
 * actually charges.
 *
 * Publishing rule (Muse's own, enforced in code): a document is NOT shown on
 * the public site while any open item is unresolved. Until then the public
 * route renders the "being finalized" placeholder (noindex) and the full
 * draft is visible only inside /team/legal, with every open item highlighted.
 *
 * To publish: fill `resolution` on every open item below (Roman's call; an
 * attorney should review first), commit, deploy. Nothing else is required —
 * the public pages flip automatically and become indexable.
 *
 * Text may reference an open item as {{item_id}}; in preview it renders as a
 * highlighted chip, in public mode as the resolution text.
 */
import { TIERS, TOP_UP_PACKS, fmtUsd } from "@/lib/agentProgram/config";

export type OpenItemKind = "confirm" | "decision";
export type OpenItem = {
  id: string;
  kind: OpenItemKind;
  /** What Roman must supply or decide. */
  prompt: string;
  /** Muse's suggested default, if any. Shown in preview; NOT used in public text. */
  workingDefault?: string;
  /** Roman's answer. Public text uses this. Leave null until decided. */
  resolution: string | null;
  /** Engineering note (e.g. a conflict with the pricing single-source). */
  note?: string;
};

export type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] } | { kind: "h3"; text: string };
export type Section = { heading: string; blocks: Block[] };
export type LegalDoc = {
  slug: "privacy" | "terms";
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  draftedBy: string;
  intro: Block[];
  sections: Section[];
  openItems: OpenItem[];
};

const solo = TIERS.find((t) => t.key === "solo")!;
const agency = TIERS.find((t) => t.key === "agency")!;
const trial = TIERS.find((t) => t.key === "trial")!;

export const PRIVACY: LegalDoc = {
  slug: "privacy",
  title: "Privacy Policy",
  effectiveDate: "2026-10-09",
  lastUpdated: "2026-10-09",
  draftedBy: "Atlas (Muse), final copy pack, October 9, 2026",
  intro: [
    { kind: "p", text: "SFB Connect (\"we,\" \"us,\" \"our\") is a brand of {{entity}}, operating at https://sfbconnect.com. This policy explains what information we collect, how we use it, and the choices you have." },
  ],
  sections: [
    {
      heading: "1. What we collect",
      blocks: [
        { kind: "h3", text: "You give us directly" },
        { kind: "ul", items: [
          "Contact details: name, company name, email address, phone number (e.g., when you start the free trial or request an AI audit).",
          "Business information: details about your business that you provide during onboarding, audits, or when configuring the SFB Agent (industry, services, locations, existing listings, competitors).",
          "Billing information: payment details are processed by our payment provider (Stripe). We do not store your full card number on our servers.",
          "Account credentials: login information for your SFB Connect account.",
          "Content you authorize: if you connect third-party tools (Google Calendar, Gmail, Meta, GoHighLevel, Zapier, or webhooks), we access only the data needed to perform the tasks you approve — for example, calendar events to book calls, or ad accounts to manage campaigns.",
        ] },
        { kind: "h3", text: "Collected automatically" },
        { kind: "ul", items: [
          "Usage data: how you use the dashboard and which agent tasks you run.",
          "Device and log data: IP address, browser type, pages visited, and timestamps, for security and debugging.",
        ] },
        { kind: "p", text: "We do not knowingly collect information from children under 13, and the service is intended for business use by adults." },
      ],
    },
    {
      heading: "2. How we use it",
      blocks: [
        { kind: "ul", items: [
          "Provide and operate the service: run your AI agent's tasks, maintain your AI Presence score, and keep your credit ledger.",
          "Onboarding and support: set up your trial, answer questions, and troubleshoot.",
          "Billing: process plan subscriptions, credit purchases, and refunds.",
          "Product improvement: analyze aggregate, de-identified usage to improve the agent (we do not sell your data).",
          "Legal and safety: prevent fraud, abuse, and violations of our Terms of Service.",
        ] },
      ],
    },
    {
      heading: "3. The SFB Agent and your data",
      blocks: [
        { kind: "p", text: "The SFB Agent is an AI system that performs tasks on your behalf — for example, researching competitors, drafting outreach, or updating listings. It may process your business information, plus publicly available data from third-party research sources, to do that work. Where a task has real-world consequences (publishing content, sending outreach, spending on ads), the agent flags it for human approval before acting — no high-impact action runs without a human (you or our team) signing off." },
        { kind: "p", text: "AI-generated outputs can be wrong. We present research as research: unverified findings are labeled as such, and we do not present uncertain data as verified fact." },
      ],
    },
    {
      heading: "4. Who we share data with",
      blocks: [
        { kind: "p", text: "We share information only as needed to run the service:" },
        { kind: "ul", items: [
          "Payment processing: Stripe (billing and checkout).",
          "Integrations you connect: Google, Meta, GoHighLevel, Zapier, and webhook endpoints — only the data required for the tasks you authorize.",
          "Research and infrastructure providers: the data sources and hosting services that power audits and AI presence tracking.",
          "Legal compliance: if required by law, court order, or to protect our rights, your account, or others.",
        ] },
        { kind: "p", text: "We do not sell your personal information. We do not share it with advertisers." },
      ],
    },
    {
      heading: "5. Credits and billing records",
      blocks: [{ kind: "p", text: "Your credit balance, task history, and transaction records are stored so you can see exactly what the agent did and what it cost. These records are available to you in the dashboard at any time." }],
    },
    {
      heading: "6. Data retention",
      blocks: [{ kind: "p", text: "We keep your account and business data while your account is active. You can request deletion of your data at any time (see \"Your rights\" below); we delete on request, except for records we are legally required to keep (billing records are retained for 7 years for tax purposes)." }],
    },
    {
      heading: "7. Security",
      blocks: [{ kind: "p", text: "We use industry-standard safeguards: encrypted connections (TLS), access controls, and least-privilege system design. No system is perfectly secure — if you believe your account has been compromised, contact us immediately at {{support_email}}." }],
    },
    {
      heading: "8. Your rights",
      blocks: [
        { kind: "p", text: "Depending on where you live, you may have the right to:" },
        { kind: "ul", items: [
          "Access a copy of the personal information we hold about you.",
          "Correct inaccurate information.",
          "Request deletion of your information.",
          "Opt out of marketing communications (every marketing email includes an unsubscribe link).",
        ] },
        { kind: "p", text: "To exercise any of these rights, email {{privacy_email}}. We respond within 30 days." },
        { kind: "p", text: "California residents: we comply with the CCPA/CPRA. We do not sell or share personal information for cross-context behavioral advertising, and we will honor authorized-agent requests." },
      ],
    },
    {
      heading: "9. Cookies",
      blocks: [{ kind: "p", text: "We use essential cookies to keep you signed in and to remember your preferences. We do not use advertising or cross-site tracking cookies on the marketing site. The app may use analytics cookies to understand aggregate usage; details appear in the in-app cookie notice." }],
    },
    {
      heading: "10. Third-party links",
      blocks: [{ kind: "p", text: "Our site may link to third-party sites (social profiles, integration partners). We are not responsible for their privacy practices." }],
    },
    {
      heading: "11. Changes to this policy",
      blocks: [{ kind: "p", text: "If we make material changes, we will post the updated policy here with a new \"Last updated\" date and, where appropriate, notify you by email before the change takes effect." }],
    },
    {
      heading: "12. Contact",
      blocks: [
        { kind: "p", text: "{{entity}}" },
        { kind: "p", text: "{{address}}" },
        { kind: "p", text: "Email: {{contact_email}}" },
        { kind: "p", text: "Location: Florida, United States" },
      ],
    },
  ],
  openItems: [
    { id: "entity", kind: "confirm", prompt: "Confirm exact registered entity name and state of registration (Atlas: Six Figure Blueprints LLC, a Florida limited liability company, per your 10-08 confirmation).", workingDefault: "Six Figure Blueprints LLC, a Florida limited liability company, d/b/a SFB Connect", resolution: null },
    { id: "support_email", kind: "confirm", prompt: "Support email (Privacy §7, security incidents).", resolution: null },
    { id: "privacy_email", kind: "confirm", prompt: "Privacy-request contact email (Privacy §8; may equal the contact email).", resolution: null },
    { id: "address", kind: "confirm", prompt: "Registered business address.", resolution: null },
    { id: "contact_email", kind: "confirm", prompt: "General contact email for the Contact section.", resolution: null },
  ],
};

export const TERMS: LegalDoc = {
  slug: "terms",
  title: "Terms of Service",
  effectiveDate: "2026-10-09",
  lastUpdated: "2026-10-09",
  draftedBy: "Atlas (Muse), final copy pack, October 9, 2026",
  intro: [
    { kind: "p", text: "These Terms form a contract between you and {{entity}} (\"we,\" \"us,\" \"our\"), operator of https://sfbconnect.com. By creating an account, starting a trial, or paying for the service, you agree to these Terms and to our Privacy Policy." },
  ],
  sections: [
    {
      heading: "1. The service",
      blocks: [
        { kind: "p", text: "SFB Connect provides \"AI Presence for Business\": tools and an AI agent that help businesses get found by AI search and automate growth work. The flagship product is the SFB Agent — one AI agent with owner-toggled capabilities across:" },
        { kind: "ul", items: ["AI Presence", "Outbound / go-to-market", "Meta ads", "Websites", "CRM + automations", "Chat & texting", "Reviews & reputation", "SOPs"] },
        { kind: "p", text: "You choose which capabilities are on; your plan tier governs credits and support level, not which capabilities you can access." },
        { kind: "p", text: "Human-in-the-loop. High-impact actions (publishing, sending outreach, ad spend) require human approval before execution. The agent proposes; a human approves. This guardrail exists to protect your business, and you agree not to circumvent it." },
        { kind: "p", text: "AI limitations. AI outputs can be incomplete or wrong. Research presented by the agent carries a confidence and verification status — unverified findings are labeled as such. You are responsible for reviewing outputs before you use them in business decisions. We do not warrant that the agent's research, copy, or recommendations are accurate, current, or fit for any particular purpose." },
      ],
    },
    {
      heading: "2. Plans, credits, and billing",
      blocks: [
        { kind: "p", text: "Plans. Subscription plans are billed in advance at the rates shown on our pricing page (monthly or yearly)." },
        { kind: "ul", items: [
          `Trial: Free. ${trial.credits} one-time credits on demo business data. No payment details required; no charge at the end of the trial. No real integrations or outbound sends.`,
          `Solo: ${fmtUsd(solo.monthlyUsd)}/month${solo.onboardingUsd ? ` plus a one-time ${fmtUsd(solo.onboardingUsd)} onboarding fee` : ""}. ${solo.credits} credits per month. One real business, all eight capabilities.`,
          `Agency: ${fmtUsd(agency.monthlyUsd)}/month${agency.onboardingUsd ? ` plus a one-time ${fmtUsd(agency.onboardingUsd)} onboarding fee` : ""}. ${agency.credits} credits per month, pooled across five white-labeled client spaces.`,
        ] },
        { kind: "p", text: "Credits. Metered work consumes SFB Action Credits at the public per-action price list shown on our site. Key rules:" },
        { kind: "ul", items: [
          "Failed work costs nothing. If the agent errors, bounces, or produces no result, no credits are charged.",
          "Work pauses at zero. You are never charged beyond what you've purchased. The agent pauses when credits run out; you top up or wait for your refill.",
          "Monthly credits do not roll over. Unused monthly credits reset at the start of each billing cycle.",
          `Purchased credit packs never expire while your membership remains active (${TOP_UP_PACKS.map((p) => `${p.credits.toLocaleString("en-US")} credits ${fmtUsd(p.usd)}`).join(" · ")}).`,
          "The ledger never goes negative. No overage charges, ever.",
          "Sending emails/messages, viewing reports, and toggling capabilities cost no credits — only the AI work behind them is metered.",
          "Credits pay for work performed, not guaranteed calls, rankings, leads, or revenue.",
        ] },
        { kind: "p", text: "Billing and refunds. Subscriptions and credit packs are non-refundable — the work happened. You may cancel at any time; your plan stays active through the end of the paid period. Chargebacks filed without first contacting us are a violation of these Terms and may result in account termination." },
        { kind: "p", text: "Payments are processed by Stripe; you agree to Stripe's terms as our payment processor." },
      ],
    },
    {
      heading: "3. Your responsibilities",
      blocks: [
        { kind: "ul", items: [
          "Account security. You are responsible for activity under your account and for keeping your credentials confidential.",
          "Accurate information. Provide accurate business details; the agent's work is only as good as its inputs.",
          "Connected accounts. When you connect third-party tools (Google, Meta, Stripe, GoHighLevel, Zapier, webhooks), you authorize us to act on those accounts within the scope of the tasks you approve, and you must hold the rights to grant that access.",
          "Lawful use. You will not use the service for spam, fraud, impersonation, harassment, or any illegal purpose; will not probe or attack our systems; and will not resell the service without written permission.",
          "Ad compliance. Meta ads and other paid campaigns run through the agent must comply with the platform's policies and applicable advertising law; you are the advertiser of record for your accounts.",
        ] },
      ],
    },
    {
      heading: "4. Acceptable use — specific to the agent",
      blocks: [
        { kind: "ul", items: [
          "Do not ask the agent to produce deceptive content (fake reviews, misleading claims, impersonation of real people or companies).",
          "Do not use outreach capabilities to send unsolicited messages that violate CAN-SPAM, TCPA, or platform policies; you are responsible for your lists and consent.",
          "Do not attempt to disable the human-approval guardrail or otherwise make the agent act beyond your authorized scope.",
        ] },
        { kind: "p", text: "Violation of this section may result in immediate suspension." },
      ],
    },
    {
      heading: "5. Intellectual property",
      blocks: [{ kind: "p", text: "You keep all rights to your business content and data. You grant us a limited license to process it in order to operate the service. The SFB Connect platform, agent, branding, and generated playbooks/tools remain ours. Playbooks, copy, and assets the agent produces for your business are yours to use." }],
    },
    {
      heading: "6. Third-party services",
      blocks: [{ kind: "p", text: "The service integrates with third-party platforms (Stripe, Google, Meta, research providers, GoHighLevel, Zapier). Those providers' terms apply to their services; we are not responsible for their outages, policy changes, or data practices." }],
    },
    {
      heading: "7. Service availability and changes",
      blocks: [{ kind: "p", text: "We work to keep the service reliable but do not guarantee uninterrupted availability. We may modify or discontinue features with reasonable notice; if a paid plan's core feature is discontinued, you receive a pro-rata credit." }],
    },
    {
      heading: "8. Termination",
      blocks: [{ kind: "p", text: "You may cancel at any time (see §2). We may suspend or terminate accounts for Terms violations, nonpayment, or abuse, with notice where practical. On termination, your access ends; you may export your data within 30 days." }],
    },
    {
      heading: "9. Disclaimers",
      blocks: [{ kind: "p", text: "THE SERVICE IS PROVIDED \"AS IS\" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. We do not guarantee rankings, AI citations, lead volume, or revenue outcomes. The free AI audit is an estimate, not a promise of results." }],
    },
    {
      heading: "10. Limitation of liability",
      blocks: [{ kind: "p", text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY FOR ANY CLAIM ARISING FROM THE SERVICE IS LIMITED TO THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM, AND WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES (INCLUDING LOST PROFITS OR BUSINESS INTERRUPTION)." }],
    },
    {
      heading: "11. Indemnification",
      blocks: [{ kind: "p", text: "You agree to indemnify and hold us harmless from claims arising from your use of the service, your connected accounts, or your violation of these Terms — including claims from recipients of your outreach or ads." }],
    },
    {
      heading: "12. Dispute resolution and governing law",
      blocks: [{ kind: "p", text: "These Terms are governed by the laws of {{governing_law}}, without regard to conflict-of-law rules. Disputes will first go through good-faith negotiation for 30 days, then binding arbitration in Florida under AAA rules, with each party bearing its own costs unless the arbitrator decides otherwise. You waive class-action participation." }],
    },
    {
      heading: "13. Changes to these Terms",
      blocks: [{ kind: "p", text: "We will post updates here with a new \"Last updated\" date. Material changes take effect 14 days after notice by email or in-app notice; continued use after that date constitutes acceptance." }],
    },
    {
      heading: "14. Contact",
      blocks: [
        { kind: "p", text: "{{entity}}" },
        { kind: "p", text: "{{address}}" },
        { kind: "p", text: "Email: {{contact_email}}" },
        { kind: "p", text: "Location: Florida, United States" },
      ],
    },
  ],
  openItems: [
    { id: "entity", kind: "decision", prompt: "Confirm exact registered entity name and state of registration.", workingDefault: "Six Figure Blueprints LLC, a Florida limited liability company, d/b/a SFB Connect", resolution: null },
    { id: "governing_law", kind: "decision", prompt: "Confirm governing law (venue is written as binding arbitration in Florida under AAA rules).", workingDefault: "the State of Florida", resolution: null },
    { id: "address", kind: "decision", prompt: "Registered business address.", resolution: null },
    { id: "contact_email", kind: "decision", prompt: "Contact email.", resolution: null },
  ],
};

export const LEGAL_DOCS: Record<LegalDoc["slug"], LegalDoc> = { privacy: PRIVACY, terms: TERMS };

export const unresolvedItems = (doc: LegalDoc) => doc.openItems.filter((i) => !i.resolution || !i.resolution.trim());
/** Public pages render the full text only when nothing is left open. */
export const isPublishable = (doc: LegalDoc) => unresolvedItems(doc).length === 0;

const TOKEN = /\{\{([a-z_]+)\}\}/g;
/** Every {{token}} in a doc must correspond to a declared open item (tested). */
export const referencedTokens = (doc: LegalDoc): string[] => {
  const texts: string[] = [];
  const walk = (b: Block) => (b.kind === "ul" ? texts.push(...b.items) : texts.push(b.text));
  doc.intro.forEach(walk);
  doc.sections.forEach((s) => s.blocks.forEach(walk));
  const out = new Set<string>();
  for (const t of texts) for (const m of t.matchAll(TOKEN)) out.add(m[1]);
  return [...out].sort();
};

export type TextPart = { kind: "text"; text: string } | { kind: "item"; item: OpenItem };
/** Splits a line into plain text and open-item references, so the renderer can highlight them in preview. */
export const splitText = (text: string, doc: LegalDoc): TextPart[] => {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index! > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    const item = doc.openItems.find((i) => i.id === m[1]);
    if (item) parts.push({ kind: "item", item });
    else parts.push({ kind: "text", text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
};

/** Public rendering: tokens become their resolutions. Throws if anything is unresolved (never render half-legal text). */
export const renderPublicText = (text: string, doc: LegalDoc): string => {
  if (!isPublishable(doc)) throw new Error(`${doc.slug} has unresolved open items`);
  return text.replace(TOKEN, (_, id) => doc.openItems.find((i) => i.id === id)?.resolution ?? _);
};
