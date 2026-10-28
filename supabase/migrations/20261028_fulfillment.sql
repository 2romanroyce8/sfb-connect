-- Fulfillment: service catalog, orders, tasks. ADDITIVE ONLY. RLS + explicit least-privilege grants in this file (Oct-30 rule).
-- No wholesale price list is seeded: platform services carry NO prices. An order's cost and retail price are entered per order by the agency (never invented here).

create table public.agy_services (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid references public.agencies(id) on delete cascade,          -- null = platform-provided
  key text not null check (key ~ '^[a-z0-9_]{2,60}$'),
  name text not null check (length(name) between 2 and 120),
  description text not null default '' check (length(description) <= 600),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique nulls not distinct (agency_id, key)
);
create table public.agy_orders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  client_id uuid not null references public.agy_clients(id) on delete cascade,
  service_id uuid references public.agy_services(id) on delete set null,
  title text not null check (length(title) between 2 and 160),
  status text not null default 'draft' check (status in ('draft','quoted','awaiting_approval','onboarding','in_development','qa','client_review','live','maintenance','canceled')),
  cost_setup_cents bigint not null default 0 check (cost_setup_cents >= 0),     -- what the agency pays to fulfill (entered by the agency)
  cost_monthly_cents bigint not null default 0 check (cost_monthly_cents >= 0),
  price_setup_cents bigint not null default 0 check (price_setup_cents >= 0),   -- what the agency charges the client (set by the agency)
  price_monthly_cents bigint not null default 0 check (price_monthly_cents >= 0),
  notes text not null default '' check (length(notes) <= 4000),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.agy_orders (agency_id, status);
create index on public.agy_orders (client_id);
create table public.agy_order_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  order_id uuid not null references public.agy_orders(id) on delete cascade,
  title text not null check (length(title) between 1 and 200),
  done_at timestamptz, done_by uuid references auth.users(id) on delete set null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.agy_order_tasks (order_id, position);
create table public.agy_order_events (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  order_id uuid not null references public.agy_orders(id) on delete cascade,
  kind text not null check (kind in ('created','status','note','task','quote')),
  body text not null default '' check (length(body) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.agy_order_events (order_id, created_at desc);

alter table public.agy_services enable row level security;
alter table public.agy_orders enable row level security;
alter table public.agy_order_tasks enable row level security;
alter table public.agy_order_events enable row level security;

create policy svc_read on public.agy_services for select to authenticated using (agency_id is null or public.agy_is_member(agency_id));
create policy svc_write on public.agy_services for all to authenticated using (agency_id is not null and public.agy_is_member(agency_id, array['owner','admin'])) with check (agency_id is not null and public.agy_is_member(agency_id, array['owner','admin']));
-- Order costs and margins are the agency's confidential numbers: staff only, never a client user (clients have no policy here at all).
create policy ord_read on public.agy_orders for select to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager','support_agent']));
create policy ord_insert on public.agy_orders for insert to authenticated with check (created_by = auth.uid() and public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']) and exists (select 1 from public.agy_clients c where c.id = client_id and c.agency_id = agy_orders.agency_id));
create policy ord_update on public.agy_orders for update to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager'])) with check (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']));
create policy task_read on public.agy_order_tasks for select to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager','support_agent']));
create policy task_insert on public.agy_order_tasks for insert to authenticated with check (public.agy_is_member(agency_id, array['owner','admin','fulfillment_manager']) and exists (select 1 from public.agy_orders o where o.id = order_id and o.agency_id = agy_order_tasks.agency_id));
create policy task_update on public.agy_order_tasks for update to authenticated using (public.agy_is_member(agency_id, array['owner','admin','fulfillment_manager'])) with check (public.agy_is_member(agency_id, array['owner','admin','fulfillment_manager']));
create policy ev_read on public.agy_order_events for select to authenticated using (public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager','support_agent']));
create policy ev_insert on public.agy_order_events for insert to authenticated with check (created_by = auth.uid() and public.agy_is_member(agency_id, array['owner','admin','sales_manager','fulfillment_manager']) and exists (select 1 from public.agy_orders o where o.id = order_id and o.agency_id = agy_order_events.agency_id));

revoke all on public.agy_services, public.agy_orders, public.agy_order_tasks, public.agy_order_events from anon, authenticated;
grant select, insert, update, delete on public.agy_services to authenticated;
grant select, insert, update on public.agy_orders to authenticated;          -- orders are canceled, never deleted
grant select, insert, update on public.agy_order_tasks to authenticated;
grant select, insert on public.agy_order_events to authenticated;            -- history is append-only
grant select, insert, update, delete on public.agy_services, public.agy_orders, public.agy_order_tasks, public.agy_order_events to service_role;
