# Runbook — CSV lead importer (RECORDS > Leads > Upload CSV)

Roman, 2026-10-18. Bulk-loads leads into `crm_leads` from a CSV with mapping, validation, dedupe, tags, pipeline placement and assignment-by-column. Every row ends up in the report — imported, merged, skipped or errored — never silently dropped.

## Where things are
| Piece | File |
|---|---|
| Page | `/team/leads/import-csv` (`app/team/(app)/leads/import-csv/page.tsx`) — button "Upload CSV" on `/team/leads` |
| UI | `components/team/LeadCsvImporter.tsx` |
| API | `app/api/team/leads/csv/route.ts` — `GET` (remembered mapping, team, stages), `POST action=preview`, `POST action=commit` (SSE progress) |
| Pure logic (tested) | `lib/crm/leadImport.ts` — `suggestLeadMapping`, `validateLeadMapping`, `buildLeadRows`, `findDuplicates`, `mergeRows`, `assigneeFor`, `tagsFor` |
| Parser | shared `lib/outbound/csvImport.ts parseCsv` (RFC-4180-ish, BOM, `,`/`;`/tab, 2 MB, 5,000 rows) |
| Schema | `supabase/migrations/20261018_lead_csv_import.sql` — `crm_leads.tags text[]`, `notes`, `custom_fields jsonb`, `phone_normalized`, `group_key`, `import_id`; `crm_lead_imports` (one row per run with the full report); `crm_lead_import_prefs` (last mapping + options per user) |
| Tests | `tests/lib/leadImport.test.ts` |

## Rules as built
- **Required:** business name and phone. Phone must normalize to 10 US digits (`lib/notify/sms.ts normalizePhone`; `+1`/11-digit accepted). Otherwise the row is an **error** with its CSV row number (header = row 1).
- **Email** is optional but, if present, must look like an email.
- **Dedupe** = same normalized phone **or** same company name (case/space-insensitive), both **within the file** (union-find, so A~B by phone and B~C by name become one group) and **against existing non-archived leads**. Each group gets a **Merge / Skip** choice (default Merge).
  - Merge within file: first row wins, blank fields filled from the others, **cities kept as "A / B"**, notes joined with " | ", tags unioned, custom fields merged. Later rows are reported `merged_in_file`.
  - Merge into existing: existing lead keeps its values; blanks filled, tags unioned, notes appended, assignee set only if it was empty. Reported `merged_existing`.
  - Skip: every row of the group reported `skipped` with the reason.
- **Tags:** global tags for all + per-row `tags` column + optional "last N rows get extra tags" (CSV position). Lower-cased, de-duplicated.
- **Stage:** any value from the pipeline (`PipelineBoard` STAGES); default `new`.
- **Assignment:** by the column mapped to *Grouping column* — each distinct value → a team member (case-insensitive match). Unmatched values stay unassigned and are counted in the report. Server re-validates assignee ids against `users.team_role`.
- **Custom columns** land in `custom_fields` under their own header. Unmapped (`ignore`) columns are dropped.
- **Remembered mapping:** saved per user on every commit; applied next time for headers that match.
- **Progress:** SSE `progress {done,total}` every 25 rows; inserts in chunks of 100. 1,000+ rows are fine within the 120 s route budget.

## Operate
- Runs: `select id, filename, row_count, imported, merged_in_file, merged_existing, skipped, errored, created_by_label, created_at from crm_lead_imports order by created_at desc;`
- A run's report: `select jsonb_array_elements(report) from crm_lead_imports where id = '<id>';`
- Leads from a run: `select business_name, phone_normalized, city, tags, pipeline_stage, assigned_rep, group_key from crm_leads where import_id = '<id>';`
- Undo a run (only if nothing has happened to those leads since): `delete from crm_leads where import_id = '<id>';` — merges into **existing** leads are updates and are not undone by this.
- "Phone invalid" on numbers you know are good: they are non-US or have extensions — the normalizer is US-only by design; fix the cell or extend `normalizePhone`.
