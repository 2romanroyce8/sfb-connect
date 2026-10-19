# Runbook — "Give HyperAgent" tab (WORKSPACE > Give HyperAgent)

Roman, 2026-10-18. The holding queue for everything Rome needs to paste into HyperAgent, so prompts stop getting lost in chat threads. One place to copy from, in send order, with an append-only history.

## Where things are
| Piece | File |
|---|---|
| Page | `/team/prompts` (`app/team/(app)/prompts/page.tsx`), sidebar WORKSPACE → Give HyperAgent (any team member) |
| UI | `components/team/PromptQueue.tsx` — Queue (cards left→right by `send_order`) and Sent Prompts (newest first) |
| API | `app/api/team/prompts/route.ts` — `GET` (queue + sent), `POST multipart` (create with files), `POST json` `{action: reorder\|done\|undo\|update}`; `app/api/team/prompts/files/[fileId]` → 5-min signed download |
| Logic | `lib/crm/promptQueue.ts` — `createCard` (inserting at an occupied order shifts later cards), `reorder` (renumbers 1..n), `markSent`, `undoSent` (10 s), `listCards` |
| Agent API | tools `add_sfb_prompt_card` and `list_sfb_prompt_cards` in `lib/agent/tools.ts`, scope **`sfb:prompts:write`** (grantable, in `DEFAULT_SCOPES`) — reachable over the SFB MCP and `POST /api/v1/agent/tools/add_sfb_prompt_card` |
| Schema | `supabase/migrations/20261018_prompt_queue.sql` — `prompt_cards`, `prompt_card_files`, private bucket `prompt-files`, trigger `prompt_cards_protect_sent` |

## Rules as built
- **Order is king.** `send_order` is explicit and editable (arrow buttons, or set it when creating). Display is always dense 1..n. Urgency (High/Medium/Low) is a color label only.
- **Plain text, verbatim.** `prompt_text` is stored as typed (CRLF normalized to LF) and rendered in a `<pre>` — never markdown. Copy puts exactly `prompt_text` on the clipboard.
- **Done = one click.** The card moves to Sent Prompts with `sent_at`; a 10-second Undo bar appears. After that the DB trigger refuses to revert it or delete it — **Sent Prompts is append-only**. Queued cards can't be deleted from the UI either (there is no delete endpoint); fix a mistake by editing the card.
- **Attachments** go to the private `prompt-files` bucket; download links are signed for 5 minutes and team-only. The agent tool cannot attach files — Atlas mentions the file in the text and Rome attaches it in the tab.
- **Agent cards** record `created_by_label` = `<client id> (agent, authorized by <user>)` and `source = agent`.

## Atlas: how to add a card
Over MCP: call `add_sfb_prompt_card` with `{ name, prompt_text, urgency?, send_order? }`. Existing authorizations issued before 2026-10-18 don't carry `sfb:prompts:write`; re-authorize once (it's in the defaults now). Check the queue first with `list_sfb_prompt_cards` to avoid duplicates.

## Operate
- Queue: `select send_order, name, urgency, created_by_label, created_at from prompt_cards where status='queued' order by send_order;`
- History: `select sent_at, name, created_by_label from prompt_cards where status='sent' order by sent_at desc;`
- Files: `select c.name, f.filename, f.size_bytes from prompt_card_files f join prompt_cards c on c.id=f.card_id;`
- Agent calls: `select * from agent_audit_log where action in ('add_sfb_prompt_card','list_sfb_prompt_cards') order by created_at desc;`

## Notify Muse, auto-refresh, queue age (2026-10-19)
- **Notify Atlas** (top of the Queue view) → `POST /api/team/prompts {action:"notify_atlas"}` → `lib/crm/notifyAtlas.ts`: one task owned by **atlas**, priority **high**, title `Notify Atlas: verify sent HyperAgent prompts`; brief starts with press time (ET), Queue vs Sent counts, the Sent prompt names and "Rome pressed Notify Atlas - verify the sent prompts above and report back." (all inside list_tasks' 400-char summary). A press within 5 min updates that task instead of creating another. The page shows "Notification sent to Atlas at 3:05 PM" only after the task is read back.
- **Auto-refresh:** the tab re-fetches `GET /api/team/prompts` every 60 s while visible and when the browser tab regains focus (`POLL_MS` in `lib/crm/promptTiming.ts`). Agent-added cards and status changes appear without a reload.
- **Queue age:** queued cards show "in queue for 2h 14m", ticking every second (from `created_at`); Sent Prompts show "Sent … after 3h 22m in queue" (frozen: `sent_at − created_at`). Tests: `tests/lib/promptTiming.test.ts`.
