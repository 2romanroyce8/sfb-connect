-- Tracks which credit threshold emails went out in the current cycle (keys: warn, exhausted → cycle start).
alter table public.businesses add column if not exists credit_alerts_sent jsonb not null default '{}'::jsonb;
