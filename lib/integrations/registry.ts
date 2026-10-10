/**
 * Integrations registry — the ONE list of what the SFB Agent plugs into.
 *
 * Consumers: the homepage "Plugs into your stack" strip, the #agent row, the
 * team Integrations page. Marketing surfaces render ONLY `live` entries.
 *
 * Status is computed, never typed in:
 *  - live:        the connect flow exists AND is proven — either self-tested
 *                 by engineering (webhooks, zapier) or verified by at least one
 *                 successful real connection by ANYONE: owner, teammate or
 *                 client (integration_provider_verifications). The owner does
 *                 not have to personally use GHL/Meta/etc. for them to go live.
 * Google Calendar is THE calendar integration (Roman, 2026-10-10).
 *  - needs_setup: code is deployed but a prerequisite is missing (vendor app
 *                 credentials in Vercel, or no verified connection yet).
 *  - planned:     not built.
 * `integrationRegistry(ctx)` is pure (testable); `loadIntegrationRegistry()`
 * reads the verification table and the environment.
 */
import { isStripeConfigured } from "@/lib/billing/stripe";
import { resendConfigured } from "@/lib/email/resend";
import type { EnvLike } from "./providers";
import { OAUTH_PROVIDERS, oauthConfigured, type OAuthProviderKey } from "./providers";
import { verifiedProviders } from "./connections";
import { LOGOS } from "./logos";

export type IntegrationStatus = "live" | "needs_setup" | "planned";
export type IntegrationCategory = "calendar" | "email" | "crm" | "automation" | "ads" | "payments" | "messaging" | "docs" | "social";
export type ConnectKind = "oauth" | "google_calendar" | "zapier_key" | "webhooks" | "env" | "system";

export type Integration = {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  logo: string | null;
  status: IntegrationStatus;
  connectKind: ConnectKind;
  /** Why it is not live yet (team page only). */
  blocker?: string;
  /** Env var names the owner must set (team page / runbook). */
  envVars?: string[];
  consoleUrl?: string;
};

export type RegistryContext = { env?: EnvLike; verified?: Set<string> };

const oauthEntry = (key: OAuthProviderKey, category: IntegrationCategory, description: string, ctx: RegistryContext): Integration => {
  const p = OAUTH_PROVIDERS[key];
  const env = ctx.env ?? process.env;
  const configured = oauthConfigured(p, env);
  const verified = ctx.verified?.has(key) ?? false;
  const status: IntegrationStatus = configured && verified ? "live" : "needs_setup";
  return {
    key, name: p.name, category, description, logo: LOGOS[key] ?? null, status, connectKind: "oauth",
    envVars: [p.env.clientId, p.env.clientSecret], consoleUrl: p.consoleUrl,
    blocker: status === "live" ? undefined : !configured ? `Register the ${p.name} app at ${p.consoleUrl} and add ${p.env.clientId} + ${p.env.clientSecret} to Vercel (redirect URI: /api/team/integrations/${key}/callback).` : `Credentials are in. Goes live on the first successful connection by anyone — you, a teammate (SYSTEM › Integrations), or a client (their dashboard › Integrations).`,
  };
};

export function integrationRegistry(ctx: RegistryContext = {}): Integration[] {
  const env = ctx.env ?? process.env;
  const verified = ctx.verified ?? new Set<string>();
  const stripeLive = ctx.env ? !!env.STRIPE_SECRET_KEY : isStripeConfigured();
  const resendLive = resendConfigured(env);
  return [
    { key: "google_calendar", name: "Google Calendar", category: "calendar", description: "Books meetings on the rep's or owner's calendar and shows availability.", logo: LOGOS.google_calendar, status: "live", connectKind: "google_calendar" },
    { key: "webhooks", name: "Webhooks", category: "automation", description: "Outbound signed webhooks on agent events; inbound endpoints that file tasks for the agent.", logo: LOGOS.webhooks, status: "live", connectKind: "webhooks" },
    { key: "zapier", name: "Zapier", category: "automation", description: "API key + REST hooks: trigger Zaps from agent events (tasks, prospects, credits).", logo: LOGOS.zapier, status: "live", connectKind: "zapier_key" },
    // System service: SFB's own transactional email sender. Customers never connect their own Resend.
    { key: "resend", name: "Resend", category: "email", description: "SFB Connect's backend email sender: trial welcome, 80% credit warning and out-of-credits notices.", logo: LOGOS.resend, status: resendLive ? "live" : "needs_setup", connectKind: "system", envVars: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"], blocker: resendLive ? undefined : "RESEND_API_KEY not set in Vercel." },
    { key: "stripe", name: "Stripe", category: "payments", description: "Checkout for Solo/Agency plans and credit top-ups; the ledger credits on webhook.", logo: LOGOS.stripe, status: stripeLive ? "live" : "needs_setup", connectKind: "env", envVars: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"], blocker: stripeLive ? undefined : "STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET not set in Vercel." },
    // Parked (Roman, 2026-10-10): no GoHighLevel account on our side yet. The OAuth flow is fully built;
    // flip this back to oauthEntry(...) when a client needs it and the marketplace app exists.
    { key: "gohighlevel", name: "GoHighLevel", category: "crm", description: "Push leads, pipelines and automations into GoHighLevel.", logo: LOGOS.gohighlevel ?? null, status: "planned", connectKind: "oauth", envVars: [OAUTH_PROVIDERS.gohighlevel.env.clientId, OAUTH_PROVIDERS.gohighlevel.env.clientSecret], consoleUrl: OAUTH_PROVIDERS.gohighlevel.consoleUrl, blocker: "Parked — offered when a client needs it. Flow is built; needs a GHL marketplace app (nothing for the owner to do now)." },
    oauthEntry("gmail", "email", "Send approved outreach from the owner's mailbox and read replies.", ctx),
    oauthEntry("meta", "ads", "Audiences, creatives and campaigns in the owner's Meta ad account.", ctx),
    oauthEntry("slack", "messaging", "Approvals and reports posted to a Slack channel.", ctx),
    oauthEntry("notion", "docs", "SOPs and playbooks published to a Notion workspace.", ctx),
    oauthEntry("linkedin", "social", "Post approved content from the owner's LinkedIn profile.", ctx),
  ];
}

/** Registry with real verification state (server only). */
export async function loadIntegrationRegistry(): Promise<Integration[]> {
  let verified = new Set<string>();
  try { verified = await verifiedProviders(); } catch { /* table missing or unreachable → nothing verified */ }
  return integrationRegistry({ verified });
}

export const liveOf = (items: Integration[]) => items.filter((i) => i.status === "live");

/** Full promise once 3+ integrations are live; a tempered line before that. */
export const stripTagline = (liveCount: number) =>
  liveCount >= 3
    ? "If it's in your stack, your agent works with it — no rip-and-replace."
    : "Integrations appear here only once they're live. More are being verified.";
