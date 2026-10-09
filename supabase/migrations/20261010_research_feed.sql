-- Prospect research feed: targets, RSS sources, findings, runs, and the
-- nightly scheduler (pg_cron → pg_net → POST /api/cron/research-feed).
-- The cron token lives in Vault; only its SHA-256 is stored in settings and
-- the route compares hashes. No secret is in this file or in the repo.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.research_feed_targets (
  id uuid primary key default gen_random_uuid(),
  vertical text not null,
  city text not null,
  state char(2) not null check (state = upper(state)),
  queries text[] null,
  active boolean not null default true,
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  unique (vertical, city, state)
);

create table if not exists public.research_feed_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rss')),
  url text not null unique,
  label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.research_feed_runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron','manual','cli')),
  status text not null default 'running' check (status in ('running','completed','completed_with_errors','failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  targets_run uuid[] not null default '{}',
  targets_skipped uuid[] not null default '{}',
  pulled int not null default 0,
  accepted int not null default 0,
  dropped jsonb not null default '{}'::jsonb,
  tasks_created int not null default 0,
  errors text[] not null default '{}'
);

create table if not exists public.research_feed_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid null references public.research_feed_runs(id) on delete set null,
  target_id uuid null references public.research_feed_targets(id) on delete set null,
  source_kind text not null check (source_kind in ('exa','rss')),
  source_url text not null,
  business_name text not null,
  website text null,
  canonical_domain text null,
  phone_e164 text null,
  city text null,
  state text null,
  category text not null,
  snippet text null,
  published_at timestamptz null,
  identity_label text not null check (identity_label in ('unverified','name_only','corroborated')),
  dedupe_key text not null,
  quality_flags text[] not null default '{}',
  accepted boolean not null default false,
  task_id uuid null references public.agent_tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
-- A prospect is filed once: accepted findings are unique by dedupe key.
create unique index if not exists research_feed_findings_accepted_key on public.research_feed_findings (dedupe_key) where accepted;
create index if not exists research_feed_findings_run on public.research_feed_findings (run_id);
create index if not exists research_feed_findings_domain on public.research_feed_findings (canonical_domain) where canonical_domain is not null;

create table if not exists public.research_feed_settings (
  id int primary key default 1 check (id = 1),
  enabled boolean not null default true,
  schedule text not null default '0 7 * * *',          -- 07:00 UTC = 03:00 America/New_York
  endpoint text not null default 'https://www.sfbconnect.com/api/cron/research-feed',
  cron_token_hash text null,
  token_rotated_at timestamptz null,
  updated_at timestamptz not null default now()
);
insert into public.research_feed_settings (id) values (1) on conflict (id) do nothing;

-- RLS: team members read everything here (it is the team's own prospecting
-- data, no customer data); only the service role writes.
alter table public.research_feed_targets enable row level security;
alter table public.research_feed_sources enable row level security;
alter table public.research_feed_runs enable row level security;
alter table public.research_feed_findings enable row level security;
alter table public.research_feed_settings enable row level security;
drop policy if exists research_feed_targets_team_read on public.research_feed_targets;
create policy research_feed_targets_team_read on public.research_feed_targets for select to authenticated using (is_team_member());
drop policy if exists research_feed_sources_team_read on public.research_feed_sources;
create policy research_feed_sources_team_read on public.research_feed_sources for select to authenticated using (is_team_member());
drop policy if exists research_feed_runs_team_read on public.research_feed_runs;
create policy research_feed_runs_team_read on public.research_feed_runs for select to authenticated using (is_team_member());
drop policy if exists research_feed_findings_team_read on public.research_feed_findings;
create policy research_feed_findings_team_read on public.research_feed_findings for select to authenticated using (is_team_member());
-- settings: owners may read (never the token hash — the column is excluded via a view-less select in app code; the hash itself is useless without the token)
drop policy if exists research_feed_settings_owner_read on public.research_feed_settings;
create policy research_feed_settings_owner_read on public.research_feed_settings for select to authenticated using (is_team_owner());

-- Seeds: the internal GTM target list (roofing, Florida metros) and the two
-- industry feeds verified reachable on 2026-10-09. Edit rows, not code.
insert into public.research_feed_targets (vertical, city, state) values
  ('roofing','Tampa','FL'), ('roofing','Orlando','FL'), ('roofing','Jacksonville','FL'), ('roofing','Miami','FL'), ('roofing','Fort Lauderdale','FL'), ('roofing','St. Petersburg','FL')
on conflict do nothing;
insert into public.research_feed_sources (kind, url, label) values
  ('rss','https://roofingmagazine.com/feed/','Roofing Magazine'),
  ('rss','https://www.constructiondive.com/feeds/news/','Construction Dive — News')
on conflict (url) do nothing;

-- ---- Scheduler -----------------------------------------------------------
-- research_feed_rotate_cron_token(): mints a fresh random token, stores it in
-- Vault (name research_feed_cron_token), stores its SHA-256 in settings, and
-- (re)schedules the nightly pg_cron job that POSTs to the endpoint with the
-- token as a Bearer header. Returns nothing: nobody ever sees the token.
create or replace function public.research_feed_rotate_cron_token()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, cron
as $$
declare
  tok text := encode(extensions.gen_random_bytes(32), 'hex');
  existing uuid;
  s public.research_feed_settings%rowtype;
begin
  select * into s from public.research_feed_settings where id = 1;
  select id into existing from vault.secrets where name = 'research_feed_cron_token' limit 1;
  if existing is null then
    perform vault.create_secret(tok, 'research_feed_cron_token', 'Bearer token for the nightly research feed cron → /api/cron/research-feed');
  else
    perform vault.update_secret(existing, tok);
  end if;
  update public.research_feed_settings
     set cron_token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'), token_rotated_at = now(), updated_at = now()
   where id = 1;
  perform public.research_feed_schedule();
end;
$$;

-- research_feed_schedule(): (re)creates the pg_cron job from settings.
create or replace function public.research_feed_schedule()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, cron
as $$
declare
  s public.research_feed_settings%rowtype;
  cmd text;
begin
  select * into s from public.research_feed_settings where id = 1;
  perform cron.unschedule(jobid) from cron.job where jobname = 'research-feed-nightly';
  if not s.enabled then return; end if;
  cmd := format(
    $c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'research_feed_cron_token' limit 1)), body := '{"trigger":"cron"}'::jsonb, timeout_milliseconds := 120000);$c$,
    s.endpoint);
  perform cron.schedule('research-feed-nightly', s.schedule, cmd);
end;
$$;

revoke all on function public.research_feed_rotate_cron_token() from public, anon, authenticated;
revoke all on function public.research_feed_schedule() from public, anon, authenticated;
