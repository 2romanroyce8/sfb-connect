-- WhatsApp Business inbound webhook events (Meta Cloud API). Separate from
-- inbound_webhook_events, whose rows belong to a customer-created token.
create table if not exists public.whatsapp_inbound_events (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  signature_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_inbound_events_created on public.whatsapp_inbound_events (created_at desc);
alter table public.whatsapp_inbound_events enable row level security;
drop policy if exists whatsapp_inbound_owner_read on public.whatsapp_inbound_events;
create policy whatsapp_inbound_owner_read on public.whatsapp_inbound_events for select to authenticated using (is_team_owner());
