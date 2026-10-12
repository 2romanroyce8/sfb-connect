-- Analytics upgrade (Roman, 2026-10-12): the Stripe mirror and company view are
-- served from a short-lived cache so a page load never hammers Stripe. One row
-- per (view, range); refreshed when older than the TTL or on an explicit refresh.
create table if not exists public.analytics_cache (
  key text primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  duration_ms integer,
  error text
);
alter table public.analytics_cache enable row level security; -- service role only
