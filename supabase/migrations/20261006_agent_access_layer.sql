-- ============================================================
-- AGENT ACCESS LAYER (Muse / Hyperagent / any OAuth 2.1 client)
--
-- Agents never receive the user's password or cookies. A user authorizes a
-- registered client on a consent screen; SFB Connect mints a separate,
-- delegated Supabase session for that user (stored encrypted at rest) and
-- issues opaque, hashed OAuth tokens. Every agent request runs under the
-- user's own JWT so RLS applies unchanged. All rows here are service-role
-- only, except a user's read of their OWN authorizations and audit trail
-- (for the Settings -> Connected Agents screen).
-- ============================================================

create table if not exists agent_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null default '{}',
  is_public boolean not null default true,
  client_secret_hash text,
  registered_by text not null default 'dynamic',   -- 'seed' | 'dynamic'
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists agent_authorizations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null references agent_clients(client_id) on delete cascade,
  workspace_label text not null default 'SFB Connect Team',
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','revoked')),
  delegated_refresh_enc text,
  delegated_access_enc text,
  delegated_access_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text
);
create index if not exists agent_authorizations_user_idx on agent_authorizations(user_id, status);

create table if not exists agent_auth_codes (
  code_hash text primary key,
  authorization_id uuid not null references agent_authorizations(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists agent_tokens (
  token_hash text primary key,
  authorization_id uuid not null references agent_authorizations(id) on delete cascade,
  kind text not null check (kind in ('access','refresh')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  replaced_by_hash text,
  created_at timestamptz not null default now()
);
create index if not exists agent_tokens_auth_idx on agent_tokens(authorization_id, kind);

create table if not exists agent_browser_handoffs (
  code_hash text primary key,
  authorization_id uuid not null references agent_authorizations(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  -- the delegated BROWSER session minted when the code is redeemed (separate
  -- refresh chain from the API session so the two can't invalidate each other)
  browser_access_enc text,
  browser_session_expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists agent_browser_handoffs_auth_idx on agent_browser_handoffs(authorization_id);

create table if not exists agent_audit_log (
  id bigserial primary key,
  authorization_id uuid references agent_authorizations(id) on delete set null,
  user_id uuid,
  client_id text,
  access_method text not null check (access_method in ('api','mcp','browser','oauth')),
  action text not null,
  resource text,
  scope text,
  result text not null check (result in ('success','denied','error')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists agent_audit_log_auth_idx on agent_audit_log(authorization_id, created_at desc);
create index if not exists agent_audit_log_user_idx on agent_audit_log(user_id, created_at desc);

create table if not exists agent_rate_limits (
  bucket_key text primary key,
  window_start timestamptz not null,
  count integer not null default 0
);

alter table agent_clients enable row level security;
alter table agent_authorizations enable row level security;
alter table agent_auth_codes enable row level security;
alter table agent_tokens enable row level security;
alter table agent_browser_handoffs enable row level security;
alter table agent_audit_log enable row level security;
alter table agent_rate_limits enable row level security;

drop policy if exists agent_auth_self_read on agent_authorizations;
create policy agent_auth_self_read on agent_authorizations for select to authenticated using (user_id = auth.uid());
drop policy if exists agent_audit_self_read on agent_audit_log;
create policy agent_audit_self_read on agent_audit_log for select to authenticated using (user_id = auth.uid());
drop policy if exists agent_clients_read on agent_clients;
create policy agent_clients_read on agent_clients for select to authenticated using (true);

insert into agent_clients (client_id, client_name, redirect_uris, is_public, registered_by)
values
  ('hyperagent', 'Hyperagent', '{}', true, 'seed'),
  ('muse', 'Muse', '{}', true, 'seed')
on conflict (client_id) do nothing;
