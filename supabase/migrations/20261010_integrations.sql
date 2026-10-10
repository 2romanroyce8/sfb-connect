-- Integrations: encrypted per-user connections for every provider, provider
-- verification (first successful connect flips the registry to "live"),
-- outbound webhooks + delivery log, inbound webhook tokens + events, and
-- Zapier API keys + REST-hook subscriptions.
-- Tokens/secrets are stored AES-256-GCM encrypted by lib/crm/tokenCrypto
-- (CALENDAR_TOKEN_ENCRYPTION_KEY) and only ever read by the service role.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  account_label text null,
  access_token_enc text null,
  refresh_token_enc text null,
  token_expires_at timestamptz null,
  scope text null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','error')),
  last_error text null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, owner_id)
);
alter table public.integration_connections enable row level security;
-- No select policy on purpose: the token columns live here. App code reads
-- non-secret columns through the service client only (same rule as
-- crm_calendar_connections).

create table if not exists public.integration_provider_verifications (
  provider text primary key,
  first_connected_at timestamptz not null default now(),
  last_connected_at timestamptz not null default now(),
  connections int not null default 1
);
alter table public.integration_provider_verifications enable row level security;
drop policy if exists ipv_team_read on public.integration_provider_verifications;
create policy ipv_team_read on public.integration_provider_verifications for select to authenticated using (is_team_member());

-- ---- Outbound webhooks -------------------------------------------------
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  secret_enc text not null,
  events text[] not null default '{*}',
  description text null,
  active boolean not null default true,
  failure_count int not null default 0,
  last_delivery_at timestamptz null,
  created_at timestamptz not null default now()
);
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  endpoint_id uuid not null references public.webhook_endpoints(id) on delete cascade,
  event text not null,
  payload jsonb not null,
  status_code int null,
  ok boolean not null default false,
  error text null,
  duration_ms int null,
  created_at timestamptz not null default now()
);
create index if not exists webhook_deliveries_endpoint on public.webhook_deliveries (endpoint_id, created_at desc);
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
drop policy if exists webhook_endpoints_owner_read on public.webhook_endpoints;
create policy webhook_endpoints_owner_read on public.webhook_endpoints for select to authenticated using (is_team_owner());
drop policy if exists webhook_deliveries_owner_read on public.webhook_deliveries;
create policy webhook_deliveries_owner_read on public.webhook_deliveries for select to authenticated using (is_team_owner());

-- ---- Inbound webhooks --------------------------------------------------
create table if not exists public.inbound_webhook_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  token_hash text not null unique,
  file_task boolean not null default true,
  received_count int not null default 0,
  last_received_at timestamptz null,
  created_at timestamptz not null default now()
);
create table if not exists public.inbound_webhook_events (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.inbound_webhook_tokens(id) on delete cascade,
  source_ip text null,
  headers jsonb not null default '{}'::jsonb,
  payload jsonb null,
  raw_body text null,
  task_id uuid null references public.agent_tasks(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists inbound_webhook_events_token on public.inbound_webhook_events (token_id, created_at desc);
alter table public.inbound_webhook_tokens enable row level security;
alter table public.inbound_webhook_events enable row level security;
drop policy if exists inbound_webhook_tokens_owner_read on public.inbound_webhook_tokens;
create policy inbound_webhook_tokens_owner_read on public.inbound_webhook_tokens for select to authenticated using (is_team_owner());
drop policy if exists inbound_webhook_events_owner_read on public.inbound_webhook_events;
create policy inbound_webhook_events_owner_read on public.inbound_webhook_events for select to authenticated using (is_team_owner());

-- ---- Zapier (API key auth + REST hooks) --------------------------------
create table if not exists public.zapier_api_keys (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Zapier',
  key_hash text not null unique,
  last_used_at timestamptz null,
  created_at timestamptz not null default now()
);
create table if not exists public.zapier_subscriptions (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null references public.zapier_api_keys(id) on delete cascade,
  event text not null,
  target_url text not null,
  created_at timestamptz not null default now(),
  unique (api_key_id, event, target_url)
);
alter table public.zapier_api_keys enable row level security;
alter table public.zapier_subscriptions enable row level security;
drop policy if exists zapier_api_keys_owner_read on public.zapier_api_keys;
create policy zapier_api_keys_owner_read on public.zapier_api_keys for select to authenticated using (is_team_owner());
drop policy if exists zapier_subscriptions_owner_read on public.zapier_subscriptions;
create policy zapier_subscriptions_owner_read on public.zapier_subscriptions for select to authenticated using (is_team_owner());
