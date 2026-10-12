-- Owner SMS alerts via carrier email-to-SMS gateways, sent through Resend
-- (Roman, 2026-10-12). Notifications only — never outreach.
--
-- Each team member stores the phone + carrier the alerts go to, per-trigger
-- toggles, and whether a test text was confirmed received. Every attempt on
-- every channel is logged in notification_deliveries so nothing fails silently.

alter table public.users add column if not exists notify_phone text;                     -- 10 US digits, normalized
alter table public.users add column if not exists notify_carrier text;                   -- key from lib/notify/sms.ts CARRIERS
alter table public.users add column if not exists notify_prefs jsonb not null default '{}'::jsonb; -- {trigger: boolean}; callback_sla cannot be turned off
alter table public.users add column if not exists notify_sms_verified_at timestamptz;    -- owner clicked "I received the test text"
alter table public.users add column if not exists notify_sms_last_bounce_at timestamptz; -- Resend reported the gateway bounced → email fallback for 7 days
alter table public.users add column if not exists notify_sms_last_bounce_reason text;

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  trigger text not null,                               -- lead_new | demo_booked | callback_sla | credits_warning | credits_exhausted | approval_pending | sms_test
  channel text not null check (channel in ('sms','email','in_app','slack')),
  to_address text,                                     -- gateway address / email / null for in_app
  body text,                                           -- what was sent (SMS part or email subject)
  part int,                                            -- 1-based SMS part index when split
  parts int,
  status text not null check (status in ('sent','failed','skipped','fallback','coalesced')),
  reason text,                                         -- why skipped/fallback/failed: no_phone, no_carrier, carrier_shutdown, recent_bounce, pref_off, send_failed:<msg>, coalesced
  provider_id text,                                    -- Resend email id
  provider_last_event text,                            -- filled in later from Resend: delivered | bounced | ...
  provider_checked_at timestamptz,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notification_deliveries_user_idx on public.notification_deliveries (user_id, channel, created_at desc);
create index if not exists notification_deliveries_trigger_idx on public.notification_deliveries (trigger, created_at desc);

alter table public.notification_deliveries enable row level security;
drop policy if exists notification_deliveries_self_select on public.notification_deliveries;
create policy notification_deliveries_self_select on public.notification_deliveries for select using (user_id = auth.uid() or is_team_owner());
-- writes: service role only (the alert fan-out runs server-side).

-- New in-app notification types for the alert triggers.
do $$
declare c text;
begin
  select conname into c from pg_constraint where conrelid = 'public.crm_notifications'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%lead_assigned%';
  if c is not null then execute format('alter table public.crm_notifications drop constraint %I', c); end if;
  alter table public.crm_notifications add constraint crm_notifications_type_check check (type in (
    'lead_assigned','research_complete','follow_up_due','follow_up_overdue','meeting_booked','meeting_soon','meeting_rescheduled','meeting_cancelled',
    'owner_task_assigned','calendar_mention','script_ready','quiz_required','sop_required','booking_sync_failed','system',
    'lead_new','callback_sla','credits_warning','approval_pending','sms_test'));
end $$;
