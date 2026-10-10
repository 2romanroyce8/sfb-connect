# Runbook — Integrations (registry, connect flows, webhooks, Zapier)

**Single source:** `lib/integrations/registry.ts`. The homepage strip, the #agent "Works with" row, `/agent`, and SYSTEM › Integrations (`/team/integrations`) all read it. Marketing shows only `live`.

## How status is computed (never typed in)
| Kind | Live when |
|---|---|
| Google Calendar | always (shipped, in use) — the calendar integration |
| Webhooks, Zapier | always (self-contained, engineering-tested) |
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
`lib/integrations/logos.ts`. Sources: Google Calendar (icon-icons/Google mark), Stripe (Stripe S), GoHighLevel (gohighlevel.com/brand-assets), Zapier/Meta/Slack/Notion (Simple Icons official paths, brand colours; Notion rendered white for the dark site), Gmail + LinkedIn (Wikimedia Commons official marks), Webhooks (gilbarbara/logos). A live integration without a logo is a test failure.

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
