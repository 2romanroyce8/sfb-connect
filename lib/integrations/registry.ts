/**
 * Integrations registry — the ONE list of what the SFB Agent plugs into.
 *
 * Consumers: the homepage "Plugs into your stack" strip, the #agent section
 * row, the team Integrations page, and anything else that talks about
 * integrations. Marketing surfaces render ONLY `live` entries, so nothing can
 * be advertised before it exists. "live" means a real connect flow exists in
 * the product and works right now; `needs_setup` means code exists but a
 * prerequisite (keys, OAuth app) is missing; `planned` means not built.
 *
 * Status is computed, not typed in: Stripe flips to live by itself when the
 * keys land in the environment (isStripeConfigured), nothing else to touch.
 */
import { isStripeConfigured } from "@/lib/billing/stripe";

export type IntegrationStatus = "live" | "needs_setup" | "planned";
export type IntegrationCategory = "calendar" | "email" | "crm" | "automation" | "ads" | "payments" | "messaging" | "docs";

export type Integration = {
  key: string;
  name: string;
  category: IntegrationCategory;
  /** What the agent does with it, in one line. */
  description: string;
  logo: string | null;
  /** Where in the product it connects (for the team page). */
  connectsAt?: string;
  status: IntegrationStatus;
  /** Why it is not live yet (shown only on the team page). */
  blocker?: string;
};

const stripeLive = () => isStripeConfigured();

export function integrationRegistry(): Integration[] {
  return [
    {
      key: "google_calendar", name: "Google Calendar", category: "calendar",
      description: "Books meetings on the rep's or owner's calendar and shows availability.",
      logo: "https://pub.hyperagent.com/api/published/pbf01M4HZ3HDR_PYQGRHH5WSG6P9A3/logo-google-calendar.png",
      connectsAt: "/team/integrations", status: "live",
    },
    {
      key: "stripe", name: "Stripe", category: "payments",
      description: "Checkout for Solo/Agency plans and credit top-ups; the ledger credits on webhook.",
      logo: "https://pub.hyperagent.com/api/published/pbf01M4HZ3HNZ_NXYGP0C5QEDXBWYY/logo-stripe.png",
      connectsAt: "Vercel env (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)",
      status: stripeLive() ? "live" : "needs_setup",
      blocker: stripeLive() ? undefined : "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set in Vercel.",
    },
    { key: "apple_calendar", name: "Apple Calendar", category: "calendar", description: "ICS download per meeting works today; no account-level connection yet.", logo: null, status: "needs_setup", blocker: "No account-level connect flow; ICS export only." },
    { key: "gohighlevel", name: "GoHighLevel", category: "crm", description: "Push leads, pipelines and automations into GHL.", logo: null, status: "planned", blocker: "Not built." },
    { key: "zapier", name: "Zapier", category: "automation", description: "Trigger zaps from agent actions.", logo: null, status: "planned", blocker: "Not built." },
    { key: "webhooks", name: "Webhooks", category: "automation", description: "Outbound webhooks on agent events.", logo: null, status: "planned", blocker: "Not built (inbound Stripe webhook only)." },
    { key: "gmail", name: "Gmail", category: "email", description: "Send approved outreach from the owner's mailbox.", logo: null, status: "planned", blocker: "Not built; transactional email runs on Resend." },
    { key: "meta", name: "Meta", category: "ads", description: "Audiences, creatives and campaigns in the owner's ad account.", logo: null, status: "planned", blocker: "Not built." },
    { key: "slack", name: "Slack", category: "messaging", description: "Approvals and reports in a channel.", logo: null, status: "planned", blocker: "Not built." },
    { key: "notion", name: "Notion", category: "docs", description: "SOPs and playbooks published to Notion.", logo: null, status: "planned", blocker: "Not built." },
  ];
}

/** What marketing may show. Nothing else, ever. */
export const liveIntegrations = () => integrationRegistry().filter((i) => i.status === "live");

export const INTEGRATIONS_STRIP_LINE = "If it's in your stack, your agent works with it — no rip-and-replace.";
