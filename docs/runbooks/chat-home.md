# Runbook — Chat-first home (Roman, 2026-10-22)
The first screen after sign-in is the assistant, for the team dashboard and the client portal (reference: a prompt-first home — big headline, large input, suggestion chips).
- Team: `/team` and post-login now land on `/team/chat`. Sidebar → Home. The numbers dashboard is `/team/dashboard` (sidebar → Dashboard).
- Client: `/dashboard` redirects to `/dashboard/chat` (after the onboarding gate, which still comes first). Overview is `/dashboard?view=overview` (nav → Overview).
- UI: `components/assistant/ChatHome.tsx` (full page). Same endpoints and confirm-before-write protocol as the floating widget (`/api/team/assistant`, `/api/dashboard/assistant`); nothing new server-side, so scoping/RLS/confirm tokens are unchanged. The floating widget hides itself on the two chat pages.
- Empty state shows a "Today" briefing card (the existing `briefing` call) under the input.
- Rollback: revert the commit; `/team/dashboard` and `/dashboard?view=overview` never moved.
