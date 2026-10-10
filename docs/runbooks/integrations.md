# Runbook — Integrations (registry, connect flows, webhooks, Zapier)

**Single source:** `lib/integrations/registry.ts`. The homepage strip, the #agent "Works with" row, `/agent`, and SYSTEM › Integrations (`/team/integrations`) all read it. Marketing shows only `live`.

## How status is computed (never typed in)
| Kind | Live when |
|---|---|
| Google Calendar | always (shipped, in use) — the calendar integration |
| Webhooks, Zapier | always (self-contained, engineering-tested) |
| Resend (system service — SFB's own sender, not customer-connectable) | `RESEND_API_KEY` set in Vercel |
| Stripe | `STRIPE_SECRET_KEY` set in Vercel |
| OAuth (GoHighLevel, Gmail, Meta, Slack, Notion, LinkedIn) | vendor app credentials in Vercel **and** one successful connection recorded |

"Verified" = `integration_provider_verifications` has a row for the provider; written by `saveConnection()` on ANY successful connection — owner, teammate (SYSTEM › Integrations) or **client** (`/dashboard/integrations`, paid tiers only; trial businesses are refused) — plus the first successful webhook delivery/receipt and the first Zapier key. The owner never has to personally connect GHL/Meta/etc.; the first client who does flips it live. Delete the row to demote a provider.

## Making an OAuth provider live (Roman, ~10 min each)
1. Create the app in the vendor console (link shown on the team page and below). Set the redirect URI to **exactly** `https://www.sfbconnect.com/api/team/integrations/<key>/callback`.
2. Add the two env vars to Vercel (Production) and redeploy.
3. Anyone connects once — you at `/team/integrations`, or a paying client at `/dashboard/integrations` → **Connect <Name>** → approve. The tile appears on the site within 5 minutes.

| Key | Console | Env vars | Scopes requested |
|---|---|---|---|
| gohighlevel (PARKED 2026-10-10 — status forced to planned in registry.ts; re-enable by swapping back to oauthEntry) | https://marketplace.gohighlevel.com/ | `GHL_CLIENT_ID`, `GHL_CLIENT_SECRET` | contacts, opportunities, calendars (read/write), locations.readonly |
| gmail | https://console.cloud.google.com/apis/credentials (same project as Calendar; enable the Gmail API — no new redirect URI needed, Gmail reuses the Calendar callback) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (shared with Calendar) | gmail.send, gmail.modify, userinfo.email |
| meta | https://developers.facebook.com/apps/ | `META_APP_ID`, `META_APP_SECRET` | ads_management, ads_read, business_management, pages_show_list, pages_read_engagement (App Review needed for ads scopes) |
| slack | https://api.slack.com/apps | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | chat:write, channels:read, channels:join, incoming-webhook |
| notion | https://www.notion.so/profile/integrations (Public integration) | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET` | (Notion uses capabilities, not scopes) |
| linkedin | https://www.linkedin.com/developers/apps | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | openid, profile, email, w_member_social |

All tokens: `integration_connections`, AES-256-GCM via `lib/crm/tokenCrypto.ts` (`CALENDAR_TOKEN_ENCRYPTION_KEY`), no RLS select policy — read by service role only through `lib/integrations/connections.ts` (`getAccessToken` refreshes automatically).

## Webhooks
- **Outbound**: `/team/integrations` → Webhooks → Add URL (https only). Secret shown once. Deliveries carry `X-SFB-Event` and `X-SFB-Signature: t=<unix>,v1=<hmac_sha256(secret, "<t>.<body>")>`; receivers must reject |now−t| > 300 s. Events: `task.created`, `task.result_posted`, `task.reviewed`, `prospect_feed.run_completed`, `credits.charged`, `gmail.sent`, `webhook.test`. Log: `webhook_deliveries`. Emission point: `lib/integrations/events.ts` → `emitIntegrationEvent()` (fire-and-forget).
- **Inbound**: create a URL (token shown once) → `POST https://www.sfbconnect.com/api/webhooks/in/<token>`. Event stored in `inbound_webhook_events` (64 KB cap) and, if enabled, filed as a task "Inbound webhook: <label>" for Atlas (HyperAgent reviews). Unknown token → 404.

## Zapier
Auth = API key (`X-API-Key`, minted on the team page, SHA-256 stored). Endpoints for the Zapier app: `GET /api/zapier/auth`, `POST/DELETE /api/zapier/subscribe` (REST hooks `{event, target_url}`), `GET /api/zapier/sample/<event>`. Events: `task.created`, `task.result_posted`, `prospect_feed.run_completed`, `credits.charged`. Build the Zapier app in the Developer Platform pointing at those three URLs; it does not need to be public to use it.

## Gmail
`lib/integrations/gmail.ts`: `sendGmail`, `listGmailMessages`, `getGmailMessage` on the connected member's own mailbox. Team API: `GET /api/team/integrations/gmail/messages[?q=|?id=]`, `POST /api/team/integrations/gmail/send`. A human triggers sends; agent drafts travel through the task queue and are sent after approval. Transactional product mail stays on Resend.

## Brand assets
`lib/integrations/logos.ts`. Sources: Google Calendar (icon-icons/Google mark), Stripe (Stripe S), GoHighLevel (gohighlevel.com/brand-assets), Zapier/Meta/Slack/Notion (Simple Icons official paths, brand colours; Notion rendered white for the dark site), Gmail + LinkedIn (Wikimedia Commons official marks), Webhooks (gilbarbara/logos), Resend (Simple Icons official path, rendered white). A live integration without a logo is a test failure.

## Tables
`integration_connections`, `integration_provider_verifications`, `webhook_endpoints`, `webhook_deliveries`, `inbound_webhook_tokens`, `inbound_webhook_events`, `zapier_api_keys`, `zapier_subscriptions` — migration `supabase/migrations/20261010_integrations.sql`.

## Failure modes
| Symptom | Fix |
|---|---|
| "X isn't configured yet" on Connect | env vars missing in Vercel → add + redeploy |
| Vendor says redirect_uri mismatch | the app's redirect must be exactly `/api/team/integrations/<key>/callback` on www |
| Connected but tile not on site | status needs BOTH configured + verified; check `integration_provider_verifications` |
| Connection shows "needs reconnect" | refresh token rejected → Disconnect, Connect again |
| Webhook failures climbing | receiver down or signature rejected; see `webhook_deliveries.error` |

## SYSTEM › Integrations page (2026-10-10)
The page is ONLY the icon grid (`components/team/IntegrationsGrid.tsx`): 11 cards (Gmail, Google Calendar, LinkedIn, Slack, Stripe, GoHighLevel, Meta, Notion, Resend, Webhooks, Zapier), sorted connected → live → needs setup → parked. One action per card (`cardAction()`): Connect / Manage / Configured (Resend, system) / none (GHL, parked). `?manage=<key>` opens the detail view under the grid (Google deck, or `IntegrationsManager only=key` — Zapier API keys and webhook URLs live there). Blocker text and env var names never appear on the overview.
- Registry audit (blockers, env vars, hidden-from-site reasons): unlinked owner-only route **/team/integrations/registry**. Not in the sidebar on purpose.
- Webhooks glyph: `public/logos/webhooks.svg` (SFB's own mark — no brand exists); `LOGOS.webhooks` points at it, so the public strip uses the same tile.

## WORKS WITH vs AI DISCOVERY (rule, 2026-10-10)
- **WORKS WITH** = things the customer can connect = registry entries with status `live` (`IntegrationsStrip`, compact variant in the homepage agent card, full variant on /agent). New Live entries appear with zero manual edits; official marks only.
- **AI DISCOVERY** (`PlatformsSection`, "Built for the new discovery layer.") = where the agent gets the business seen: ChatGPT, Claude, Perplexity, Grok, Gemini, AI Search, AI Assistants. Not connectable, never in the registry, never labelled "works with"/"integrates with". The strip is no longer rendered inside this section.
- Guarded by `tests/lib/integrationsRegistry.test.ts` (no name may appear in both lists).

## Six integrations added 2026-10-10 (Roman spec) — setup steps
All six are **Needs setup / hidden from the site** until keys are in Vercel AND a real connection is verified. Nothing is marked Live by hand. Official marks in `public/logos/`. Each has a Connect/Manage card on SYSTEM › Integrations and a Connect card in the customer dashboard. Redirect URIs below are exact — register them character-for-character.

| # | Integration | Vendor console | Env (Vercel, Production) | Redirect / webhook URL | Scopes | Goes Live when |
|---|---|---|---|---|---|---|
| 1 | **Google Business Profile** | console.cloud.google.com → same project as Calendar/Gmail → OAuth client → add redirect URI; APIs → enable "My Business Business Information" + "My Business Account Management"; OAuth consent → add scope | reuses `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | `https://www.sfbconnect.com/api/team/integrations/google_business_profile/callback` | `business.manage`, `userinfo.email` | first successful Connect. UI note: GBP API needs **per-location business verification** before it returns listing data |
| 2 | **Microsoft Outlook / 365** | portal.azure.com → App registrations → New (Accounts in any org directory + personal) → Certificates & secrets → client secret | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `https://www.sfbconnect.com/api/team/integrations/outlook/callback` (platform: Web) | `offline_access User.Read Calendars.ReadWrite Mail.Send` (delegated; add under API permissions → Microsoft Graph) | first successful Connect |
| 3 | **HubSpot** | developers.hubspot.com → developer account → Apps → Create public app → Auth tab | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | `https://www.sfbconnect.com/api/team/integrations/hubspot/callback` | `crm.objects.contacts.read crm.objects.contacts.write` | first successful Connect |
| 4 | **QuickBooks** | developer.intuit.com → My Apps → Create app (QuickBooks Online and Payments) → Keys & credentials (Development first, Production after their review) | `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET` | `https://www.sfbconnect.com/api/team/integrations/quickbooks/callback` | `com.intuit.quickbooks.accounting` | first successful Connect (realmId stored as connection metadata) |
| 5 | **WhatsApp Business** | developers.facebook.com → the existing Meta app → Add product: WhatsApp → API Setup (phone number id, system-user token) → Configuration → Webhook | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (optional `WHATSAPP_VERIFY_TOKEN`; otherwise derived, shown owner-only on the card) | Callback `https://www.sfbconnect.com/api/team/integrations/whatsapp/callback`; subscribe field `messages` | n/a (system-user token) | Meta's webhook verification handshake succeeds (that GET marks the provider verified). UI note: needs a **dedicated business number**, not a personal one |
| 6 | **TikTok** | developers.tiktok.com → Manage apps → Create → add Login Kit → Redirect URI → submit for review | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | `https://www.sfbconnect.com/api/team/integrations/tiktok/callback` | `user.info.basic` (minimum; posting scopes need **app review — start it early**) | first successful Connect |

Mechanics: `lib/integrations/providers.ts` (`clientIdParam: "client_key"` for TikTok; `tokenAuth: "basic", basicBodyFormat: "form"` for Intuit; `callbackMetaParams: ["realmId"]`), `lib/integrations/whatsapp.ts` (+ `app/api/team/integrations/whatsapp/callback/route.ts`, table `whatsapp_inbound_events`, migration `20261010_whatsapp_inbound.sql`). Tests: `tests/lib/integrations.test.ts`, `tests/lib/integrationsRegistry.test.ts`.
