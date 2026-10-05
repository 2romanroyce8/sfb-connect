-- SFB Research Specification v1 -- additive schema for the entity-intelligence layer.
-- Applied to production 2026-10-05 via supabase apply_migration (research_entity_intelligence_layer).
alter table public.crm_research_results add column if not exists research_status text not null default 'complete'
  check (research_status in ('complete','completed_with_limitations','failed'));
alter table public.crm_research_results add column if not exists identity_confidence text not null default 'uncertain'
  check (identity_confidence in ('confirmed','uncertain','conflict','not_found'));
alter table public.crm_research_results add column if not exists profile_type text
  check (profile_type is null or profile_type in ('BUSINESS_PAGE','CREATOR','PUBLIC_PROFILE','PERSONAL_PROFILE','GROUP','EVENT','UNKNOWN'));
alter table public.crm_research_results add column if not exists detected_scope text;
alter table public.crm_research_results add column if not exists research_confidence_pct integer check (research_confidence_pct is null or research_confidence_pct between 0 and 100);
alter table public.crm_research_results add column if not exists fields_verified integer;
alter table public.crm_research_results add column if not exists fields_total integer;
alter table public.crm_research_results add column if not exists sources_checked integer;
alter table public.crm_research_results add column if not exists sources_fetched integer;
alter table public.crm_research_results add column if not exists conflicts jsonb not null default '[]'::jsonb;
alter table public.crm_research_results add column if not exists limitations jsonb not null default '[]'::jsonb;
alter table public.crm_research_results add column if not exists reconciled_profile jsonb;
alter table public.crm_research_results add column if not exists canonical_domain text;
alter table public.crm_research_results add column if not exists primary_phone_e164 text;
alter table public.crm_research_results add column if not exists seed_canonical_url text;

create table if not exists public.crm_research_sources (
  id uuid primary key default uuid_generate_v4(),
  research_result_id uuid not null references public.crm_research_results(id) on delete cascade,
  ordinal integer not null,
  url text not null,
  canonical_url text,
  platform text not null,
  link_type text not null,
  priority smallint not null check (priority between 0 and 3),
  is_first_party boolean not null default false,
  association text not null default 'uncertain' check (association in ('confirmed_first_party','likely_first_party','uncertain','rejected_unrelated','not_applicable')),
  discovered_from_ordinal integer,
  discovery_method text,
  depth smallint,
  fetch_status text not null check (fetch_status in ('fetched','blocked_login_wall','unreachable','skipped_priority','skipped_budget','generic_platform_shell','not_attempted')),
  skip_reason text,
  profile_type text,
  activity_status text check (activity_status is null or activity_status in ('ACTIVE','RECENTLY_ACTIVE','INACTIVE','STALE','UNKNOWN')),
  last_activity_at timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_sources_result on public.crm_research_sources(research_result_id, ordinal);
alter table public.crm_research_sources enable row level security;
create policy "research_sources_read" on public.crm_research_sources for select
  using (exists (select 1 from public.crm_research_results r where r.id = crm_research_sources.research_result_id and (public.is_team_owner() or r.submitted_by = auth.uid())));

create index if not exists idx_crm_leads_website_lower on public.crm_leads (lower(website));
create index if not exists idx_crm_leads_phone on public.crm_leads (phone);
create index if not exists idx_research_results_canonical_domain on public.crm_research_results (canonical_domain);
create index if not exists idx_research_results_primary_phone on public.crm_research_results (primary_phone_e164);
