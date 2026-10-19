-- CSV lead importer (Roman, 2026-10-18) — RECORDS > Leads > Upload CSV.
-- Leads gain tags / notes / custom fields / a normalized phone for dedupe, and
-- every import is recorded with its full per-row report (nothing is ever
-- silently dropped). The last column mapping is remembered per user.
alter table public.crm_leads add column if not exists tags text[] not null default '{}';
alter table public.crm_leads add column if not exists notes text;
alter table public.crm_leads add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.crm_leads add column if not exists phone_normalized text;   -- 10 US digits, set on import / edit
alter table public.crm_leads add column if not exists import_id uuid;
alter table public.crm_leads add column if not exists group_key text;          -- the grouping column's value (e.g. state_group FL/TX/GA-AZ)
create index if not exists crm_leads_phone_norm_idx on public.crm_leads (phone_normalized) where phone_normalized is not null;
create index if not exists crm_leads_name_lower_idx on public.crm_leads (lower(business_name));
create index if not exists crm_leads_tags_idx on public.crm_leads using gin (tags);
create index if not exists crm_leads_import_idx on public.crm_leads (import_id) where import_id is not null;

-- Backfill normalized phones for anything already there (same rule as lib/notify/sms.ts normalizePhone).
update public.crm_leads set phone_normalized = case
  when length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) = 11 and left(regexp_replace(phone, '\D', '', 'g'), 1) = '1' then substr(regexp_replace(phone, '\D', '', 'g'), 2)
  when length(regexp_replace(coalesce(phone,''), '\D', '', 'g')) = 10 then regexp_replace(phone, '\D', '', 'g')
  else null end
where phone is not null and phone_normalized is null;

create table if not exists public.crm_lead_imports (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  row_count integer not null default 0,
  imported integer not null default 0,
  merged_in_file integer not null default 0,
  merged_existing integer not null default 0,
  skipped integer not null default 0,
  errored integer not null default 0,
  mapping jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  report jsonb not null default '[]'::jsonb,       -- [{row, status, reason, name}] for every non-imported row + merges
  created_by uuid,
  created_by_label text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table public.crm_lead_imports enable row level security;
drop policy if exists crm_lead_imports_team_read on public.crm_lead_imports;
create policy crm_lead_imports_team_read on public.crm_lead_imports for select to authenticated
  using (exists (select 1 from public.users u where u.id = auth.uid() and u.team_role is not null));

create table if not exists public.crm_lead_import_prefs (
  user_id uuid primary key,
  mapping jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.crm_lead_import_prefs enable row level security;
drop policy if exists crm_lead_import_prefs_self on public.crm_lead_import_prefs;
create policy crm_lead_import_prefs_self on public.crm_lead_import_prefs for select to authenticated using (user_id = auth.uid());
