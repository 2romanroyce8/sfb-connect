# Spike — Can SFB read/post a customer's Meta Muse conversations? (2026-10-11)

**Question (load-bearing for "Connect Muse + in-dashboard Muse chat"):** is there a documented, $0 mechanism for a third-party app to (a) send a message into a user's Muse session, (b) read the user's Muse conversation, or (c) run "their Muse" inside our UI on their credits?

**Answer: No — none of the three exist in Meta's public surface as of 2026-10-11.** Muse connects *outward* to services (SFB is already such a service); nothing documented lets a service reach *into* a user's Muse.

## Evidence (primary sources first)
| Source | What it says | Implication |
|---|---|---|
| Meta Help Center — *How Muse works with Connectors* (meta.com/help/artificial-intelligence/1687253048996149) | Connectors are set up in Muse (Settings → Connectors, or "Connect my Gmail"). **Custom connectors:** "ask Muse to create a Custom Connector … retrieving API information from the service … Meta doesn't review custom connectors." Approval policy per connector: retrieve-only vs actions. | The user adds SFB from inside Muse. SFB cannot initiate the handshake. |
| Meta Help Center — *How to manage your Muse data* (…/2225571704857152) | Conversation history lives in the user's Muse; access/edit/delete via the app; **export = manual "Download your Muse data"**. No API mentioned. | No programmatic read of conversations. |
| Meta AI Research — *How We Built Safety Into Muse* (research.meta.ai, 2026-09-08) | Each user has a dedicated **Secure VM**; "Muse clients (iOS, Android, web UI) connect directly to your VM via a secure transport layer"; Sentinel is the sole permission authority for connector actions and egress; credentials stored in the VM. | The conversation is inside a per-user VM with a private client transport. No third-party client surface is described. |
| dev.meta.ai — Model API (Responses / Chat Completions / Messages), Muse Code, session messaging | Model API = call the **Muse Spark model with your own key** (billed to the developer). Muse Code session messaging = local, same user, same machine only. Nothing addresses the consumer Muse's sessions. | A dashboard chat on Model API would be SFB-paid inference and not "their Muse" → violates $0 and the honesty rule. |
| muse.ai/platform (reported 2026-09-19 by three independent submitters: museaiconnectors.com, noodleseed.com, shipwithmuse.live) | Reviewed **connector directory** submission: "Existing MCP" or "Raw API", OAuth with PKCE, callbacks `muse.ai/connect/oauth-callback`, requires HTTPS site, privacy + terms URLs, support contact, 512×512 icon. No SDK, no published developer terms. | A listed connector = one-tap connect inside Muse. Still outward-only; no conversation access. |
| Help Center (same page) | "Some Connectors can also share information proactively with Muse (e.g., calendar connectors)… We identify Connectors that do this before you connect them." | A proactive-push channel exists for **reviewed** connectors; mechanism is undocumented publicly. Could become "SFB tells Muse something happened" after directory review — unverified. |
| playhitch.com (first-hand, 2026-09-19) | Muse can render a self-contained HTML widget returned by a connector (no iframes, no localStorage); unknown whether a widget can post into the chat. | Rich cards inside Muse are possible; still not a channel into the conversation from outside. |

## What is buildable at $0, honestly
1. **"Connect Muse" card** = status of the user's Muse grant (from `agent_authorizations`), scopes, last activity, **Disconnect** (full revoke), reconnect prompt when revoked, and a **copy-paste "connect" message** the user sends to their Muse ("Create a custom connector for SFB Connect: MCP server https://www.sfbconnect.com/api/v1/agent/mcp, OAuth sign-in"). Muse handles OAuth → our consent screen → grant appears on the card. This is the only "Connect" that exists.
2. **Customer-scoped grants.** Today the consent screen admits team members only (`not_a_team_member`). For customers, grants must be workspace-scoped to their business and the MCP tools must run under the customer's RLS (they already run as the authorizing user). Real work, no new paid service.
3. **Session context (static core + dynamic per-session).** MCP `initialize.instructions` already exists; extend it with the versioned static core (1 agent / 8 capabilities / credits / governance) and server-generated workspace state (profile, balance, toggles, recent activity). Every Muse session opens knowing what the SFB agent is. No client copies.
4. **Directory listing (Roman's action).** Submit SFB at muse.ai/platform (Existing MCP). Free. Makes connect one tap inside Muse and is the only route to any proactive push. Review time unknown.

## What is NOT buildable without inventing
- In-dashboard chat that *is* the customer's Muse (their credits, their conversation). No API. A chat box here would be either SFB-paid inference or a fake — both ruled out.
- Bidirectional sync (type in muse.ai ↔ appears in dashboard). No read or write API for Muse conversations.

**Recommendation:** build 1–3; Roman submits 4; drop the in-dashboard chat and the mirror, and say so in the UI: "Chat with your agent in Muse — it's connected here."
