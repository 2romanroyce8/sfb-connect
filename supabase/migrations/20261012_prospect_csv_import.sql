-- Customer list upload (Roman, 2026-10-12): customers bring their own leads as CSV.
-- Imported prospects are tagged with their source + the upload they came from so
-- they stay distinguishable from agent-found leads. Importing costs 0 credits.
create table if not exists public.outbound_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  filename text not null,
  uploaded_by text not null,
  uploaded_by_user uuid,
  mapping jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists outbound_imports_business on public.outbound_imports(business_id, created_at desc);
alter table public.outbound_imports enable row level security; -- service role only, like the other outbound tables

alter table public.outbound_prospects
  add column if not exists source text not null default 'agent',
  add column if not exists import_id uuid references public.outbound_imports(id) on delete set null,
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;
alter table public.outbound_prospects drop constraint if exists outbound_prospects_source_check;
alter table public.outbound_prospects add constraint outbound_prospects_source_check check (source in ('agent','feed','manual','upload'));
update public.outbound_prospects set source = 'feed' where finding_id is not null and source = 'agent';
create index if not exists outbound_prospects_import on public.outbound_prospects(import_id) where import_id is not null;
