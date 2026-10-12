# Runbook — Guided tours (reusable tour system)

Roman, 2026-10-12. Sits over the 11-step onboarding and the dashboard. $0. Skip is always one tap away; a tour only reads the page — dismissing never changes onboarding state.

## Where things are
| Piece | File |
|---|---|
| Tour definitions (data) + pure helpers (placement, skip-missing, progress) | `lib/tours/definitions.ts` — `TOURS`, `placeTooltip`, `nextPresentStep` |
| Engine + UI (spotlight, card, bottom sheet, keyboard, auto-start, replay) | `components/tours/TourProvider.tsx` — mounted in `components/customerPortal/PortalShell.tsx`; `useTour()`, `TourLauncher` |
| API (state + analytics) | `GET/POST /api/dashboard/tours` |
| Tables | `user_tour_state` (per user per tour: status, last_step, dont_show, times_started), `tour_events` (tour_key, session_id, event, step_index, device — **no user/business id**) — migration `20261012_tours.sql` |
| Replay | Help page (`/dashboard/support` → Guided tours) and the `?` button in the sidebar footer |
| Tests | `tests/lib/tours.test.ts` |

## Adding or editing a tour (no engine change)
Add an entry to `TOURS`: `{ key, name, description, autoStart(pathname), steps: [{ id, target: '[data-tour="…"]', title, body, placement?, route? }] }` and put the matching `data-tour` attribute on the element. If a step has `route`, the engine navigates there first and waits ≤ 2.5 s for the target. Keep bodies to 1–2 sentences (the test enforces 20–220 chars). Roman reviews copy — it's his voice.

Anchors today: `onb-step-1…11` (the onboarding step panel, locked or not), `activity`, `agent-panel`, `nav-<slug>` on every sidebar link (`nav-actions`, `nav-agent`, `nav-reports`, `nav-credits`…).

## Behaviour
- Auto-starts once per user on first entry (`autoStart(pathname)` true and no `user_tour_state` row). Never again after completed / skipped / "Don't show again"; replay is explicit.
- Missing target → `step_skipped` event, moves on (both directions); nothing present → tour just ends. Never a broken tour.
- Desktop: dimmed spotlight (box-shadow, pointer-through so the highlighted action is clickable) + 320 px card placed below → above → right → left, clamped to the viewport. Mobile (< 640 px): bottom sheet.
- Keyboard: Esc = skip, → / Enter = next, ← = back.

## Analytics
`select tour_key, event, step_index, count(*) from tour_events group by 1,2,3 order by 1,3,2;` — started vs completed vs skipped per step shows drop-off. `device` splits desktop/mobile. No PII by design.

## Operate
- A customer says the tour "keeps coming back": `select * from user_tour_state where user_id = …` — a `started` row without completion still blocks auto-start; `dont_show=true` blocks forever.
- Copy change: edit `TOURS` only; deploy.
