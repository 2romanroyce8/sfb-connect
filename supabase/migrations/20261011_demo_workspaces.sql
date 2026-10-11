-- Phase 2 slice (a): the 5-day demo IS the product (2026-10-11).
-- Signup = website URL + work email → build show → profile review → email code
-- gate → (slice a2) Gmail OAuth → first 3 tasks. No sandbox, no stock data:
-- the business row carries the real profile the agent extracted and the owner
-- corrected. The 5-day clock (trial_expires_at) and the 128 credits start at
-- email verification — the moment the agent is allowed to act.

alter table public.businesses
  add column if not exists phone text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists slug text,
  add column if not exists brand_logo_url text,
  add column if not exists brand_colors jsonb not null default '[]'::jsonb,
  add column if not exists tone_notes text,
  add column if not exists services jsonb not null default '[]'::jsonb,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists email_verified_at timestamptz,
  add column if not exists demo_build_id uuid;
create unique index if not exists businesses_slug_key on public.businesses(slug) where slug is not null;

-- What the build show extracted from the site, before an account exists.
create table if not exists public.demo_builds (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  url text not null,
  domain text not null,
  facts jsonb not null default '{}'::jsonb,
  status text not null default 'built' check (status in ('built','claimed')),
  business_id uuid references public.businesses(id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists demo_builds_email_idx on public.demo_builds(email, created_at desc);
alter table public.demo_builds enable row level security; -- service role only

-- 6-digit email verification codes (hashed; 10-minute expiry; attempts counted).
create table if not exists public.email_verification_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_codes_user_idx on public.email_verification_codes(user_id, created_at desc);
alter table public.email_verification_codes enable row level security; -- service role only
