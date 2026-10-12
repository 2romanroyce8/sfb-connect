-- Template library + custom emails (Roman, 2026-10-12). System presets live in
-- code (lib/outbound/presets.ts, approved copy). This table holds what a
-- customer saves: a sent email kept as a preset, or a custom email they wrote.
create table if not exists public.outbound_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'saved' check (category in ('saved','custom')),
  subject text not null,
  body text not null,
  source_message_id uuid references public.outbound_messages(id) on delete set null,
  created_by text not null,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists outbound_templates_business on public.outbound_templates(business_id, archived, created_at desc);
alter table public.outbound_templates enable row level security; -- service role only, like the other outbound tables

-- The intro the business chose (preset key or 'saved:<uuid>'); null = agent recommendation applies.
alter table public.businesses add column if not exists outbound_intro_template text;
-- The variable-form source that produced a draft, so "save as preset" keeps variables, not one prospect's name.
alter table public.outbound_messages add column if not exists template_source jsonb;
