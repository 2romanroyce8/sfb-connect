-- Client portal: client users, invites, onboarding intake. ADDITIVE ONLY. RLS + least-privilege grants in this file (Oct-30 rule).
-- Client users see ONLY their own client record and onboarding; agency staff see their agency's clients. Nothing references SFB's internal crm_* data.

create table public.agy_client_members (
  client_id uuid not null references public.agy_clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);
create index on public.agy_client_members (user_id);
create table public.agy_client_invites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.agy_clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  email text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  token_hash text not null unique,                       -- only the SHA-256 of the link token is stored
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.agy_onboarding (
  client_id uuid primary key references public.agy_clients(id) on delete cascade,
  agency_id uuid not null references public.agencies(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','submitted','changes_requested','approved')),
  review_note text,
  submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create or replace function public.agy_is_client_member(p_client uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.agy_client_members m where m.client_id = p_client and m.user_id = auth.uid());
$$;
revoke all on function public.agy_is_client_member(uuid) from public, anon;
grant execute on function public.agy_is_client_member(uuid) to authenticated, service_role;

alter table public.agy_client_members enable row level security;
alter table public.agy_client_invites enable row level security;
alter table public.agy_onboarding enable row level security;

create policy cm_read on public.agy_client_members for select to authenticated using (user_id = auth.uid() or public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));
create policy inv_read on public.agy_client_invites for select to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));
create policy inv_insert on public.agy_client_invites for insert to authenticated with check (created_by = auth.uid() and public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));
create policy ob_read on public.agy_onboarding for select to authenticated using (public.agy_is_client_member(client_id) or public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager','support_agent']));
create policy ob_client_insert on public.agy_onboarding for insert to authenticated with check (public.agy_is_client_member(client_id) and status in ('draft','submitted'));
create policy ob_client_update on public.agy_onboarding for update to authenticated using (public.agy_is_client_member(client_id) and status in ('draft','changes_requested')) with check (public.agy_is_client_member(client_id) and status in ('draft','submitted'));
create policy ob_staff_update on public.agy_onboarding for update to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager'])) with check (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));
-- A client user may read their own client record (agency staff already can).
create policy clients_member_read on public.agy_clients for select to authenticated using (public.agy_is_client_member(id));

revoke all on public.agy_client_members, public.agy_client_invites, public.agy_onboarding from anon, authenticated;
grant select on public.agy_client_members to authenticated;
grant select, insert on public.agy_client_invites to authenticated;
grant select, insert, update on public.agy_onboarding to authenticated;
grant select, insert, update, delete on public.agy_client_members, public.agy_client_invites, public.agy_onboarding to service_role;
