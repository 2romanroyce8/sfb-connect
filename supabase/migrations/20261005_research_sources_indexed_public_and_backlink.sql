-- Instagram public-index recovery: a source can be known from a search index without being fetched by us,
-- and a source can carry a verified link back to the seed account.
-- Applied to production 2026-10-05 via supabase apply_migration (research_sources_indexed_public_and_backlink).
alter table public.crm_research_sources drop constraint if exists crm_research_sources_fetch_status_check;
alter table public.crm_research_sources add constraint crm_research_sources_fetch_status_check check (fetch_status in ('fetched','indexed_public','blocked_login_wall','unreachable','skipped_priority','skipped_budget','generic_platform_shell','not_attempted'));
alter table public.crm_research_sources add column if not exists links_to_seed boolean not null default false;
