-- Owner data control: every manual delete / category wipe / workspace reset
-- is logged with a JSON snapshot of the removed rows, so a mistake is
-- recoverable by the owner (or by support) from this table.
create table if not exists crm_data_deletion_log (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  kind text not null check (kind in ('row','category','reset')),
  category text not null,
  row_id text,
  rows_deleted integer not null default 0,
  snapshot jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table crm_data_deletion_log enable row level security;
drop policy if exists data_deletion_log_owner_read on crm_data_deletion_log;
create policy data_deletion_log_owner_read on crm_data_deletion_log for select to authenticated using (is_team_owner());
