-- G5 (Roman, 2026-10-12): failed owner-alert deliveries (SMS gateway / email via
-- Resend) are retried on the hourly cron instead of being logged and forgotten.
-- A retry is a NEW row pointing at the row it retried; the original is stamped
-- retried_at so it is claimed exactly once. Up to 3 attempts within 24 h.
alter table public.notification_deliveries add column if not exists attempts integer not null default 1;
alter table public.notification_deliveries add column if not exists retried_at timestamptz;
alter table public.notification_deliveries add column if not exists retry_of uuid references public.notification_deliveries(id) on delete set null;
create index if not exists notification_deliveries_retry_idx on public.notification_deliveries (created_at desc) where status = 'failed' and retried_at is null;
