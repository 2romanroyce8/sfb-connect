-- Agency CRM: pipeline stages, leads, activity history, follow-ups. ADDITIVE ONLY; no existing table is touched; agency tables never reference crm_* (SFB internal).
-- Oct-30 rule: RLS + explicit least-privilege grants in this same file.

create table public.agy_pipeline_stages (
  agency_id uuid not null references public.agencies(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  label text not null check (length(label) between 1 and 40),
  position int not null,
  is_won boolean not null default false,
  is_lost boolean not null default false,
  primary key (agency_id, key)
);
create table public.agy_leads (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  business_name text not null check (length(business_name) between 2 and 160),
  contact_name text, email text, phone text, website text, city text, source text,
  stage text not null default 'new_lead',
  value_cents bigint not null default 0 check (value_cents >= 0),
  expected_close date,
  owner_id uuid references auth.users(id) on delete set null,
  demo_id uuid references public.agy_demo_projects(id) on delete set null,
  archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (agency_id, stage) references public.agy_pipeline_stages(agency_id, key) on update cascade
);
create unique index agy_leads_email_uniq on public.agy_leads (agency_id, lower(email)) where email is not null and archived = false;
create index agy_leads_agency_stage on public.agy_leads (agency_id, stage);
create index agy_leads_owner on public.agy_leads (owner_id);
create table public.agy_lead_activities (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.agy_leads(id) on delete cascade,
  kind text not null check (kind in ('created','note','call','stage_change','demo_sent','demo_viewed','followup')),
  body text not null default '' check (length(body) <= 4000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index agy_lead_activities_lead on public.agy_lead_activities (lead_id, created_at desc);
create table public.agy_followups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  lead_id uuid not null references public.agy_leads(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  due_at timestamptz not null,
  assigned_to uuid references auth.users(id) on delete set null,
  done_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index agy_followups_due on public.agy_followups (agency_id, due_at) where done_at is null;

-- Default pipeline. Idempotent; service_role only (called when an agency is created).
create or replace function public.agy_seed_stages(p_agency uuid) returns void language sql security definer set search_path = public as $$
  insert into public.agy_pipeline_stages (agency_id, key, label, position, is_won, is_lost) values
    (p_agency,'new_lead','New Lead',1,false,false),(p_agency,'contacted','Contacted',2,false,false),(p_agency,'qualified','Qualified',3,false,false),
    (p_agency,'demo_sent','Demo Sent',4,false,false),(p_agency,'demo_viewed','Demo Viewed',5,false,false),(p_agency,'meeting_booked','Meeting Booked',6,false,false),
    (p_agency,'proposal_sent','Proposal Sent',7,false,false),(p_agency,'won','Won',8,true,false),(p_agency,'lost','Lost',9,false,true)
  on conflict do nothing;
$$;
revoke all on function public.agy_seed_stages(uuid) from public, anon, authenticated;
grant execute on function public.agy_seed_stages(uuid) to service_role;
select public.agy_seed_stages(id) from public.agencies;

-- RLS
alter table public.agy_pipeline_stages enable row level security;
alter table public.agy_leads enable row level security;
alter table public.agy_lead_activities enable row level security;
alter table public.agy_followups enable row level security;

create policy stages_read on public.agy_pipeline_stages for select to authenticated using (public.agy_is_member(agency_id));
create policy stages_write on public.agy_pipeline_stages for all to authenticated using (public.agy_is_member(agency_id, array['owner','admin'])) with check (public.agy_is_member(agency_id, array['owner','admin']));
-- Reps see and change only leads they own; managers, admins and owners see all; fulfillment/support read all.
create policy leads_read on public.agy_leads for select to authenticated using (
  public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager','support_agent']) or (public.agy_is_member(agency_id, array['sales_rep']) and owner_id = auth.uid()));
create policy leads_insert on public.agy_leads for insert to authenticated with check (
  public.agy_is_member(agency_id, array['owner','admin','sales_manager']) or (public.agy_is_member(agency_id, array['sales_rep']) and owner_id = auth.uid()));
create policy leads_update on public.agy_leads for update to authenticated using (
  public.agy_is_member(agency_id, array['owner','admin','sales_manager']) or (public.agy_is_member(agency_id, array['sales_rep']) and owner_id = auth.uid()))
  with check (public.agy_is_member(agency_id, array['owner','admin','sales_manager']) or (public.agy_is_member(agency_id, array['sales_rep']) and owner_id = auth.uid()));
-- History and follow-ups follow lead visibility (the subquery runs under the caller's own RLS).
create policy acts_read on public.agy_lead_activities for select to authenticated using (exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_lead_activities.agency_id));
create policy acts_insert on public.agy_lead_activities for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_lead_activities.agency_id));
create policy fu_read on public.agy_followups for select to authenticated using (exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_followups.agency_id));
create policy fu_insert on public.agy_followups for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_followups.agency_id));
create policy fu_update on public.agy_followups for update to authenticated using (exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_followups.agency_id)) with check (exists (select 1 from public.agy_leads l where l.id = lead_id and l.agency_id = agy_followups.agency_id));

revoke all on public.agy_pipeline_stages, public.agy_leads, public.agy_lead_activities, public.agy_followups from anon, authenticated;
grant select, insert, update, delete on public.agy_pipeline_stages to authenticated;
grant select, insert, update on public.agy_leads to authenticated;           -- no delete: leads are archived, never removed
grant select, insert on public.agy_lead_activities to authenticated;          -- history is append-only
grant select, insert, update on public.agy_followups to authenticated;
grant select, insert, update, delete on public.agy_pipeline_stages, public.agy_leads, public.agy_lead_activities, public.agy_followups to service_role;
