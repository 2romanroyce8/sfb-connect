-- Seed entity lock: the URL the user gave is the entity; it is resolved first and stored immutably on the result.
-- Applied to production 2026-10-05 via supabase apply_migration (research_seed_entity_lock).
alter table public.crm_research_results add column if not exists seed_platform text;
alter table public.crm_research_results add column if not exists seed_platform_id text;
alter table public.crm_research_results add column if not exists seed_username text;
alter table public.crm_research_results add column if not exists seed_display_name text;
alter table public.crm_research_results add column if not exists seed_entity_hint text;
alter table public.crm_research_results add column if not exists seed_resolved boolean;
alter table public.crm_research_sources add column if not exists entity_match_status text
  check (entity_match_status is null or entity_match_status in ('MATCHED','PROBABLE_MATCH','POSSIBLE_MATCH','UNVERIFIED','CONFLICTING','REJECTED'));
alter table public.crm_research_sources add column if not exists entity_match_reasons jsonb not null default '[]'::jsonb;
alter table public.crm_research_sources add column if not exists source_entity_name text;
alter table public.crm_research_sources add column if not exists source_quality text
  check (source_quality is null or source_quality in ('PRIMARY','VERIFIED','CORROBORATING','WEAK','IRRELEVANT'));
create index if not exists idx_research_sources_match on public.crm_research_sources(research_result_id, entity_match_status);
