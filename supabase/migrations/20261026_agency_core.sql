-- Agency platform core (Phase 2/3 foundation). ADDITIVE ONLY: no existing table is altered.
-- Prefix agy_ avoids collisions with existing leads/projects/payments/clients. SFB's internal /team data (crm_*, outbound_*) is never referenced by these tables.
-- Oct-30 Supabase rule: every table gets RLS + explicit least-privilege GRANTs in this same file.


create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),
  owner_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now()
);
create table public.agency_members (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','sales_manager','sales_rep','fulfillment_manager','support_agent')),
  status text not null default 'active' check (status in ('invited','active','disabled')),
  created_at timestamptz not null default now(),
  primary key (agency_id, user_id)
);
create or replace function public.agy_is_member(p_agency uuid, p_roles text[] default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agency_members m where m.agency_id = p_agency and m.user_id = auth.uid() and m.status = 'active' and (p_roles is null or m.role = any(p_roles)));
$$;
revoke all on function public.agy_is_member(uuid, text[]) from public, anon;
grant execute on function public.agy_is_member(uuid, text[]) to authenticated, service_role;

create table public.agency_branding (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  display_name text, logo_url text, primary_color text default '#287BFF', contact_email text, website text, booking_url text, updated_at timestamptz not null default now()
);
create table public.agency_domains (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  hostname text not null unique check (hostname = lower(hostname)),
  verification_token text not null default encode(gen_random_bytes(16),'hex'),
  verified_at timestamptz,  -- a hostname only serves tenant content after DNS verification; unique(hostname) stops cross-tenant attach
  created_at timestamptz not null default now()
);
create table public.agy_industry_packs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,  -- null = platform-provided
  key text not null, name text not null, config jsonb not null default '{}'::jsonb, is_active boolean not null default true,
  created_at timestamptz not null default now(), unique nulls not distinct (agency_id, key)
);
create table public.agy_demo_projects (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  business_name text not null, website_url text, industry_key text, location text, config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (agency_id, slug)
);
create table public.agy_demo_sessions (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references public.agy_demo_projects(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  started_at timestamptz not null default now(), consented boolean not null default false
);
create table public.agy_demo_events (
  id bigint generated always as identity primary key,
  demo_id uuid not null references public.agy_demo_projects(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  session_id uuid references public.agy_demo_sessions(id) on delete set null,
  event text not null check (event in ('demo_opened','session_started','chat_started','voice_started','audit_requested','cta_clicked','booking_requested','lead_submitted')),
  created_at timestamptz not null default now()
);
create table public.agy_clients (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  name text not null, website text, status text not null default 'prospect' check (status in ('prospect','onboarding','active','paused','churned')),
  created_at timestamptz not null default now()
);
create index on public.agency_members (user_id);
create index on public.agy_demo_projects (agency_id);
create index on public.agy_demo_events (demo_id, created_at);
create index on public.agy_clients (agency_id);

-- RLS
alter table public.agencies enable row level security;
alter table public.agency_members enable row level security;
alter table public.agency_branding enable row level security;
alter table public.agency_domains enable row level security;
alter table public.agy_industry_packs enable row level security;
alter table public.agy_demo_projects enable row level security;
alter table public.agy_demo_sessions enable row level security;
alter table public.agy_demo_events enable row level security;
alter table public.agy_clients enable row level security;

create policy agencies_read on public.agencies for select to authenticated using (public.agy_is_member(id));
create policy agencies_update on public.agencies for update to authenticated using (public.agy_is_member(id, array['owner','admin'])) with check (public.agy_is_member(id, array['owner','admin']));
create policy members_read on public.agency_members for select to authenticated using (user_id = auth.uid() or public.agy_is_member(agency_id, array['owner','admin']));
create policy members_manage on public.agency_members for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin'])) with check (public.agy_is_member(agency_id, array['owner','admin']));
create policy branding_read on public.agency_branding for select to authenticated using (public.agy_is_member(agency_id));
create policy branding_write on public.agency_branding for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin'])) with check (public.agy_is_member(agency_id, array['owner','admin']));
create policy domains_read on public.agency_domains for select to authenticated using (public.agy_is_member(agency_id));
create policy domains_write on public.agency_domains for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin'])) with check (public.agy_is_member(agency_id, array['owner','admin']) and verified_at is null);
create policy packs_read on public.agy_industry_packs for select to authenticated using (agency_id is null or public.agy_is_member(agency_id));
create policy packs_write on public.agy_industry_packs for all to authenticated using (agency_id is not null and public.agy_is_member(agency_id, array['owner','admin'])) with check (agency_id is not null and public.agy_is_member(agency_id, array['owner','admin']));
create policy demos_read on public.agy_demo_projects for select to authenticated using (public.agy_is_member(agency_id));
create policy demos_write on public.agy_demo_projects for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','sales_rep'])) with check (public.agy_is_member(agency_id, array['owner','admin','sales_manager','sales_rep']));
create policy sessions_read on public.agy_demo_sessions for select to authenticated using (public.agy_is_member(agency_id));
create policy events_read on public.agy_demo_events for select to authenticated using (public.agy_is_member(agency_id));
create policy clients_read on public.agy_clients for select to authenticated using (public.agy_is_member(agency_id));
create policy clients_write on public.agy_clients for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager'])) with check (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));

-- Pre-Oct-30 projects auto-grant everything to anon/authenticated on new tables; strip that first, then grant only what is needed.
revoke all on public.agencies, public.agency_members, public.agency_branding, public.agency_domains, public.agy_industry_packs, public.agy_demo_projects, public.agy_demo_sessions, public.agy_demo_events, public.agy_clients from anon, authenticated;
-- GRANTS (least privilege). Public demo visitors never touch tables directly: session/event writes go through server routes using service_role.
grant select, update on public.agencies to authenticated;                       -- inserts happen in the signup server route (service_role)
grant select, insert, update, delete on public.agency_members, public.agency_branding, public.agency_domains, public.agy_industry_packs, public.agy_demo_projects, public.agy_clients to authenticated;
grant select on public.agy_demo_sessions, public.agy_demo_events to authenticated;
grant select, insert, update, delete on public.agencies, public.agency_members, public.agency_branding, public.agency_domains, public.agy_industry_packs, public.agy_demo_projects, public.agy_demo_sessions, public.agy_demo_events, public.agy_clients to service_role;
grant usage, select on sequence public.agy_demo_events_id_seq to service_role;
