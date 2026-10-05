-- Person / Business / Relationship entity model for research results.
-- A Facebook personal profile is a SOURCE TYPE, never an identity verdict.
-- Applied to production 2026-10-05 via supabase apply_migration (research_entity_relationship_layer).
alter table public.crm_research_results add column if not exists source_type text;
alter table public.crm_research_results add column if not exists entity_type text
  check (entity_type is null or entity_type in ('PERSON','BUSINESS','PERSON_OPERATING_BUSINESS','CREATOR','ORGANIZATION','UNKNOWN'));
alter table public.crm_research_results add column if not exists business_status text
  check (business_status is null or business_status in ('BUSINESS','PERSON_OPERATING_BUSINESS','BUSINESS_IDENTITY_UNCERTAIN','NO_BUSINESS_IDENTIFIED'));
alter table public.crm_research_results add column if not exists person_name text;
alter table public.crm_research_results add column if not exists relationship_type text;
alter table public.crm_research_results add column if not exists relationship_basis text
  check (relationship_basis is null or relationship_basis in ('corroborated','self_described','inferred'));
alter table public.crm_research_results add column if not exists relationship_confidence text
  check (relationship_confidence is null or relationship_confidence in ('HIGH','MEDIUM','LOW'));

alter table public.crm_leads add column if not exists source_type text;
alter table public.crm_leads add column if not exists entity_type text;
alter table public.crm_leads add column if not exists relationship_type text;
alter table public.crm_leads add column if not exists relationship_basis text;

create table if not exists public.crm_research_entities (
  id uuid primary key default uuid_generate_v4(),
  research_result_id uuid not null references public.crm_research_results(id) on delete cascade,
  entity_kind text not null check (entity_kind in ('person','business')),
  name text,
  attributes jsonb not null default '{}'::jsonb,
  confidence text check (confidence is null or confidence in ('HIGH','MEDIUM','LOW')),
  sources jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_entities_result on public.crm_research_entities(research_result_id);
alter table public.crm_research_entities enable row level security;
create policy "research_entities_read" on public.crm_research_entities for select
  using (exists (select 1 from public.crm_research_results r where r.id = crm_research_entities.research_result_id and (public.is_team_owner() or r.submitted_by = auth.uid())));

create table if not exists public.crm_research_entity_relationships (
  id uuid primary key default uuid_generate_v4(),
  research_result_id uuid not null references public.crm_research_results(id) on delete cascade,
  person_entity_id uuid references public.crm_research_entities(id) on delete cascade,
  business_entity_id uuid references public.crm_research_entities(id) on delete cascade,
  relationship_type text not null,
  basis text not null check (basis in ('corroborated','self_described','inferred')),
  confidence text not null check (confidence in ('HIGH','MEDIUM','LOW')),
  sources jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_entity_rel_result on public.crm_research_entity_relationships(research_result_id);
alter table public.crm_research_entity_relationships enable row level security;
create policy "research_entity_rel_read" on public.crm_research_entity_relationships for select
  using (exists (select 1 from public.crm_research_results r where r.id = crm_research_entity_relationships.research_result_id and (public.is_team_owner() or r.submitted_by = auth.uid())));
