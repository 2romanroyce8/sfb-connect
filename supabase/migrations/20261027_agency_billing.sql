-- Agency billing state: the $49/mo platform subscription (on SFB Connect's own Stripe account) and each agency's Stripe Connect account id/status.
-- Written ONLY by the server (service_role: checkout return, Stripe webhook, Connect status refresh). Members can read their agency's row; nobody can write from the browser.
create table public.agency_billing (
  agency_id uuid primary key references public.agencies(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text check (subscription_status in ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  connect_account_id text,
  connect_charges_enabled boolean not null default false,
  connect_payouts_enabled boolean not null default false,
  connect_details_submitted boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index agency_billing_sub_uniq on public.agency_billing (stripe_subscription_id) where stripe_subscription_id is not null;
create unique index agency_billing_connect_uniq on public.agency_billing (connect_account_id) where connect_account_id is not null;
alter table public.agency_billing enable row level security;
create policy billing_read on public.agency_billing for select to authenticated using (public.agy_is_member(agency_id));
revoke all on public.agency_billing from anon, authenticated;
grant select on public.agency_billing to authenticated;
grant select, insert, update, delete on public.agency_billing to service_role;
