# Runbook — Prospect research feed (Exa + RSS → task queue)

**What it is:** every night at 07:00 UTC (03:00 ET) the feed searches Exa (company category) and reads industry RSS feeds for NEW local businesses matching each active target (vertical × city × state), runs them through dedup + geo + chain/junk filters, persists every candidate with its verdict, and files **one task per target** in the agent task queue ("Qualify N new roofing prospects — Tampa, FL", owner Atlas, reviewer HyperAgent). The internal GTM agent is its first customer.

**What it is not:** it never confirms a business. Feed labels are `corroborated` / `name_only` / `unverified` — weaker than the research layer's `confirmed` on purpose. Confirmation only happens through the full seed-based research pipeline (`/team/leads/import`).

## Code map
| Piece | Path |
|---|---|
| Types | `lib/research/feed/types.ts` |
| Exa source | `lib/research/feed/sources/exa.ts` (uses `EXA_API_KEY`, logs to `discovery_search_calls`) |
| RSS source + parser + US state table | `lib/research/feed/sources/rss.ts` |
| Quality rules (geo, chains, directories, junk, labels, dedupe key) | `lib/research/feed/quality.ts` |
| Dedup (batch / CRM / prior findings) | `lib/research/feed/dedupe.ts` |
| Orchestrator (deadline, persist, file tasks) | `lib/research/feed/run.ts` |
| Cron endpoint | `app/api/cron/research-feed/route.ts` (POST, Bearer token) |
| Team status + Run now (owner) | `app/api/team/research-feed/route.ts`, panel `components/team/ResearchFeedPanel.tsx` on `/team/research` |
| CLI | `scripts/research-feed.ts` |
| Schema + scheduler | `supabase/migrations/20261010_research_feed.sql` |
| Tests | `tests/research/feed.test.ts` |

## Tables
- `research_feed_targets` — vertical, city, state(2-letter, upper), optional `queries[]`, `active`, `last_run_at`. **Add/pause targets here; no deploy.**
- `research_feed_sources` — kind `rss`, url, label, active. **Add feeds here.** Verify a feed returns `<rss` or `<feed` before adding.
- `research_feed_findings` — every candidate, accepted or not, with `quality_flags[]`, `identity_label`, `dedupe_key`, `task_id`. Unique on `dedupe_key` where accepted → a prospect is filed once, ever.
- `research_feed_runs` — one row per run: trigger, status, pulled/accepted/dropped, tasks_created, errors, targets_run/skipped.
- `research_feed_settings` — single row: `enabled`, `schedule` (cron), `endpoint`, `cron_token_hash`.
RLS: team members read all; owners read settings; only the service role writes.

## Data-quality rules (the audit's fixes)
1. **City + state required.** Target city in the text wins; else the first `City, ST` pair; else `missing_city_state` → dropped.
2. **US only.** 50 states + DC. Anything else → `non_us`. Different state than the target → `state_mismatch`.
3. **Chains/franchises/manufacturers/distributors** (`CHAIN_BRANDS`, `CHAIN_DOMAINS`, franchise wording) → `chain_or_franchise`.
4. **Directories, aggregators, social, news hosts** as the "website" → `directory_or_aggregator`.
5. **Junk names** (generic service phrases, person names, "best roofers in…", too short/long) → `junk_name`.
6. **Dedup**: within the batch (domain/phone/name+city), against `crm_leads` + `crm_research_results`, against prior accepted findings.
7. **Labels are honest** (see above). Related fix in the research layer: `reconcile.ts` now requires corroboration from ≥2 independent sources **and** a hard signal (or ≥3 sources) before saying `confirmed`, and the detail view says "Profile completeness" instead of "Research confidence" so a 44% completeness is never read as a 44% identity.

Drop reasons are counted per run and stored per finding — tune the lists in `quality.ts`, and the tests pin each rule.

## Scheduler (fully inside Supabase)
`pg_cron` job `research-feed-nightly` runs `net.http_post` to `settings.endpoint` with `Authorization: Bearer <vault secret research_feed_cron_token>`. The route hashes the presented token (SHA-256) and compares to `settings.cron_token_hash` in constant time. `CRON_SECRET` (Vercel convention) is also accepted if ever set.

- **Rotate the token** (also re-schedules): `select public.research_feed_rotate_cron_token();` — nobody sees the token; it goes straight from `gen_random_bytes` into Vault.
- **Change schedule**: `update research_feed_settings set schedule='0 8 * * *' where id=1; select public.research_feed_schedule();`
- **Pause**: `update research_feed_settings set enabled=false where id=1; select public.research_feed_schedule();` (the route also refuses to run while disabled).
- **Inspect**: `select jobname, schedule, active from cron.job;` · `select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;` · `select * from net._http_response order by created desc limit 5;`

## Manual run
- Dashboard: `/team/research` → Nightly prospect feed → **Dry run** (persists nothing) or **Run now** (owner only).
- CLI (needs service-role env locally): `npx tsx scripts/research-feed.ts [--target roofing:Tampa:FL] [--sources exa,rss] [--commit]`; `--offline fixtures.json` runs the pipeline on a JSON array of RawFinding with no network.

## Limits & costs
- Serverless-safe: the run self-bounds at 45 s (`maxDuration = 60`), processes targets oldest-run-first, and reports the rest as `targets_skipped` — they lead the next run. If targets are routinely skipped, lower `limitPerTarget` or split the schedule.
- Exa: ≤2 queries per target per night (~$0.007 each per `discovery_budget_settings`). 6 targets ≈ $0.08/night.
- RSS: each feed fetched once per run, 10 s timeout, items older than 14 days ignored.

## Failure modes
| Symptom | Cause | Fix |
|---|---|---|
| Run row `errors: ["no source is configured…"]` | `EXA_API_KEY` missing in Vercel and no active RSS feed | set the key / activate a feed |
| cron.job_run_details `failed` with vault error | Vault secret missing | `select public.research_feed_rotate_cron_token();` |
| Route returns 401 to cron | token hash mismatch (rotated but job not rescheduled) | rotate again (it reschedules) |
| Task not created but findings accepted | `agent_tasks` insert refused | see `agent-task-queue.md`; run row `errors` has the message |
| Same business filed twice | different domains/phones and no city match | add the alias domain to the first finding's row or dedupe by hand in the queue |

## Succession
Nothing here needs a person alive: schedule is in the DB, token is in Vault, code is in `main`. To stop everything: pause as above. To hand over: this file + `agent-task-queue.md`.
