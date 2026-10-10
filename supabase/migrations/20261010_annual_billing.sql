-- Annual billing for SFB Agent plans (pricing page overhaul, 2026-10-10).
-- Annual = 10 × monthly, billed once a year; the one-time setup fee is unchanged.
-- Credits still refill MONTHLY on annual plans. Stripe only invoices yearly, so a
-- daily pg_cron job calls /api/cron/plan-refill, which grants the monthly
-- allotment to any annual business whose cycle is a month old (idempotent).

alter table public.agent_plan_orders
  add column if not exists billing_interval text not null default 'month'
  check (billing_interval in ('month','year'));

-- Settings + token for the billing cron (same pattern as research_feed_settings).
create table if not exists public.billing_cron_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  endpoint text not null default 'https://www.sfbconnect.com/api/cron/plan-refill',
  schedule text not null default '30 6 * * *', -- daily 06:30 UTC
  cron_token_hash text,
  token_rotated_at timestamptz,
  last_run_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.billing_cron_settings (id) values (1) on conflict (id) do nothing;
alter table public.billing_cron_settings enable row level security;
drop policy if exists billing_cron_settings_owner_read on public.billing_cron_settings;
create policy billing_cron_settings_owner_read on public.billing_cron_settings for select to authenticated using (is_team_owner());

create or replace function public.billing_cron_schedule()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, cron
as $$
declare
  s public.billing_cron_settings%rowtype;
  cmd text;
begin
  select * into s from public.billing_cron_settings where id = 1;
  perform cron.unschedule(jobid) from cron.job where jobname = 'billing-plan-refill-daily';
  if not s.enabled then return; end if;
  cmd := format(
    $c$select net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'billing_cron_token' limit 1)), body := '{"trigger":"cron"}'::jsonb, timeout_milliseconds := 60000);$c$,
    s.endpoint);
  perform cron.schedule('billing-plan-refill-daily', s.schedule, cmd);
end;
$$;

create or replace function public.billing_cron_rotate_token()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault, cron
as $$
declare
  tok text := encode(extensions.gen_random_bytes(32), 'hex');
  existing uuid;
begin
  select id into existing from vault.secrets where name = 'billing_cron_token' limit 1;
  if existing is null then
    perform vault.create_secret(tok, 'billing_cron_token', 'Bearer token for the daily plan-refill cron → /api/cron/plan-refill');
  else
    perform vault.update_secret(existing, tok);
  end if;
  update public.billing_cron_settings
     set cron_token_hash = encode(extensions.digest(tok, 'sha256'), 'hex'), token_rotated_at = now(), updated_at = now()
   where id = 1;
  perform public.billing_cron_schedule();
end;
$$;

revoke all on function public.billing_cron_rotate_token() from public, anon, authenticated;
revoke all on function public.billing_cron_schedule() from public, anon, authenticated;

select public.billing_cron_rotate_token();
