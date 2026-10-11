-- Outbound / GTM end-to-end (Phase 1, Roman 2026-10-11):
-- enrich → write → approval → send → track → book, with credit enforcement on
-- every charged step and a HARD approval gate on every send.
-- Status is data; nothing here is customer-facing until the capability flips live.

-- The one sentence the owner approved for outreach copy (never invented; empty = outreach cannot be drafted).
alter table public.businesses add column if not exists outbound_offer_line text;
alter table public.businesses add column if not exists outbound_time_zone text not null default 'America/New_York';

create table if not exists public.outbound_prospects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  finding_id uuid null references public.research_feed_findings(id) on delete set null,
  name text not null,                     -- business / company name (verified source only)
  contact_name text null,                 -- person, if a public page names one
  website text null,
  canonical_domain text null,
  email text null,
  email_source text null,                 -- 'mailto' | 'visible' | 'manual' — where the email was read
  phone_e164 text null,
  city text null,
  state text null,
  category text null,
  status text not null default 'sourced' check (status in ('sourced','enriched','in_sequence','replied','booked','unsubscribed','bounced','archived')),
  enrichment jsonb not null default '{}'::jsonb,
  enriched_at timestamptz null,
  last_contacted_at timestamptz null,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists outbound_prospects_domain_key on public.outbound_prospects (business_id, canonical_domain) where canonical_domain is not null;
create unique index if not exists outbound_prospects_email_key on public.outbound_prospects (business_id, lower(email)) where email is not null;
create index if not exists outbound_prospects_business on public.outbound_prospects (business_id, status);

create table if not exists public.outbound_sequences (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  steps jsonb not null,                    -- [{ day: 0, template: 'intro' }, { day: 3, template: 'follow_up_1' }, ...]
  status text not null default 'active' check (status in ('draft','active','paused')),
  created_at timestamptz not null default now()
);

create table if not exists public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid not null references public.outbound_prospects(id) on delete cascade,
  sequence_id uuid null references public.outbound_sequences(id) on delete set null,
  step integer not null default 0,
  direction text not null default 'out' check (direction in ('out','in')),
  channel text not null default 'email',
  to_email text null,
  subject text null,
  body_text text null,
  template_key text null,
  -- The gate: a message is sent ONLY from 'approved' with approved_by set. Nothing else reaches Gmail.
  status text not null default 'draft' check (status in ('draft','pending_approval','approved','rejected','sent','simulated','failed','bounced','received')),
  approval_requested_at timestamptz null,
  approved_by uuid null references public.users(id) on delete set null,
  approved_at timestamptz null,
  rejected_reason text null,
  scheduled_for timestamptz null,
  sent_at timestamptz null,
  gmail_message_id text null,
  gmail_thread_id text null,
  in_reply_to text null,                   -- our message id this inbound replies to
  opened_at timestamptz null,
  open_count integer not null default 0,
  replied_at timestamptz null,
  credit_tx_id uuid null references public.credit_transactions(id) on delete set null,
  error text null,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists outbound_messages_business_status on public.outbound_messages (business_id, status, created_at desc);
create index if not exists outbound_messages_prospect on public.outbound_messages (prospect_id, created_at desc);
create index if not exists outbound_messages_thread on public.outbound_messages (gmail_thread_id) where gmail_thread_id is not null;

create table if not exists public.outbound_bookings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid not null references public.outbound_prospects(id) on delete cascade,
  message_id uuid null references public.outbound_messages(id) on delete set null,
  calendar_owner_id uuid null references public.users(id) on delete set null,
  calendar_event_id text null,
  meet_url text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  time_zone text not null default 'America/New_York',
  status text not null default 'scheduled' check (status in ('scheduled','canceled','completed','no_show')),
  credit_tx_id uuid null references public.credit_transactions(id) on delete set null,
  created_by text not null default 'system',
  created_at timestamptz not null default now()
);

create table if not exists public.outbound_suppressions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('unsubscribed','bounced','manual')),
  created_at timestamptz not null default now(),
  unique (business_id, email)
);

create table if not exists public.outbound_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  prospect_id uuid null references public.outbound_prospects(id) on delete cascade,
  message_id uuid null references public.outbound_messages(id) on delete cascade,
  kind text not null,                      -- enriched | drafted | approval_requested | approved | rejected | sent | simulated | opened | replied | booked | unsubscribed | bounced | failed
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists outbound_events_business on public.outbound_events (business_id, created_at desc);

-- Unsubscribe tokens are per message: sha256(message id + business id) is computed in code, never stored.

-- RLS: a customer sees their own business's outbound; team owners see everything; writes go through the service role.
alter table public.outbound_prospects enable row level security;
alter table public.outbound_sequences enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.outbound_bookings enable row level security;
alter table public.outbound_suppressions enable row level security;
alter table public.outbound_events enable row level security;
do $$ declare t text; begin
  foreach t in array array['outbound_prospects','outbound_sequences','outbound_messages','outbound_bookings','outbound_suppressions','outbound_events'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (is_team_owner() or business_id in (select id from public.businesses where owner_id = auth.uid()))', t, t);
  end loop;
end $$;

-- Cron settings + token for the hourly outbound sync (same pattern as billing_cron_settings).
create table if not exists public.outbound_cron_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  endpoint text not null default 'https://www.sfbconnect.com/api/cron/outbound-sync',
  schedule text not null default '15 * * * *', -- hourly at :15 UTC
  cron_token_hash text,
  token_rotated_at timestamptz,
  last_run_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.outbound_cron_settings (id) values (1) on conflict (id) do nothing;
alter table public.outbound_cron_settings enable row level security;
drop policy if exists outbound_cron_settings_owner_read on public.outbound_cron_settings;
create policy outbound_cron_settings_owner_read on public.outbound_cron_settings for select to authenticated using (is_team_owner());

create or replace function public.outbound_cron_schedule()
returns void language plpgsql security definer set search_path = public, extensions, vault, cron as $$
declare s public.outbound_cron_settings%rowtype; cmd text;
begin
  select * into s from public.outbound_cron_settings where id = 1;
  perform cron.unschedule(jobid) from cron.job where jobname = 'outbound-sync-hourly';
  if not s.enabled then return; end if;
  cmd := format($c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'outbound_cron_token' limit 1)), body := '{"trigger":"cron"}'::jsonb, timeout_milliseconds := 60000);$c$, s.endpoint);
  perform cron.schedule('outbound-sync-hourly', s.schedule, cmd);
end; $$;

create or replace function public.outbound_cron_rotate_token()
returns void language plpgsql security definer set search_path = public, extensions, vault, cron as $$
declare tok text := encode(extensions.gen_random_bytes(32), 'hex'); existing uuid;
begin
  select id into existing from vault.secrets where name = 'outbound_cron_token' limit 1;
  if existing is null then perform vault.create_secret(tok, 'outbound_cron_token', 'Bearer token for the hourly outbound sync → /api/cron/outbound-sync');
  else perform vault.update_secret(existing, tok); end if;
  update public.outbound_cron_settings set cron_token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'), token_rotated_at = now(), updated_at = now() where id = 1;
  perform public.outbound_cron_schedule();
end; $$;
revoke all on function public.outbound_cron_rotate_token() from public, anon, authenticated;
revoke all on function public.outbound_cron_schedule() from public, anon, authenticated;
select public.outbound_cron_rotate_token();
