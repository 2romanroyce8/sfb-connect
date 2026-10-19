# Runbook — Dashboard assistant (chatbot)

Floating chat in `/team` (team) and the client portal `/dashboard` (clients). $0: no paid model in the code path.

| Layer | Status | What |
|---|---|---|
| 1 — Intent router | **Live 2026-10-19** | `lib/assistant/router.ts` (pure regex/slot matcher, ET dates), 30 team + 22 client intents. Instant, no network. |
| 2 — Free-tier LLM (Gemini) | Not wired | For messages the router can't match. Until then: help + suggestions. |
| 3 — Swappable brain | Seam in place | `lib/assistant/llm.ts`: `ASSISTANT_LLM_PROVIDER` = `none` (default) · `gemini` · `openai_compatible`. No provider makes a network call yet. |

## Safety
- **Confirm before every write.** Writes return a proposal with an HMAC token (`lib/assistant/confirm.ts`) bound to role + user (+ business for clients) + the exact action, valid 10 min. The confirm call must match or nothing runs. Delegated read-only agent sessions can't confirm writes.
- **Team:** session Supabase client throughout → crm_* RLS (owner: all; rep: own assigned leads/follow-ups/meetings). Owner-only: outbound status, agent tasks, reassigning. "Won" is refused in chat (needs the plan; use the board).
- **Clients:** business resolved on the server from the signed-in user (never from the request). Every read pinned to `business_id` (or `businesses.id` + `owner_id`) **and** runs on the session client (RLS = second lock). Writes re-check ownership. Never reads crm_*/agent_*/team tables. Enforced by `tests/lib/assistantIsolation.test.ts` (two businesses, every client intent).
- Proactive briefing on first open: team — overdue/today follow-ups, today's meetings, stuck deals, outbound approvals (owner); client — next setup step, drafts waiting, low credits.

## Files
`lib/assistant/{router,team,client,confirm,llm,types}.ts` · `app/api/team/assistant` · `app/api/dashboard/assistant` · `components/assistant/AssistantWidget.tsx` · tests `assistantRouter`, `assistantIsolation`, `assistantConfirm`.
