-- "Your Agent's First 7 Days" analyzer: 24h cache of public scans by domain,
-- and the link from a trial business back to the scan that brought it in.
create table if not exists public.analyzer_scans (
  domain text primary key,
  result jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.analyzer_scans enable row level security;
-- No policies: service-role only (public visitors never read the table directly; the API streams results).

alter table public.businesses add column if not exists analyzer_scan_domain text;
