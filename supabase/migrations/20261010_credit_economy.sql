-- Credit economy hardening (Roman spec 2026-10-10).
-- credit_transactions IS the append-only ledger (spec: credit_ledger). This adds
-- the two missing receipt columns and moves the spend path into ONE atomic,
-- idempotent Postgres function so a retried request can never double-spend and
-- the balance can never go negative — even under concurrent requests.

alter table public.credit_transactions
  add column if not exists result_ref text,
  add column if not exists approved_by uuid references public.users(id) on delete set null;

-- spend_credits: the only way agent work should charge credits.
--  * p_cost = 0 → a "didn't go through" / free row is still written (receipt).
--  * idempotency_key seen → returns the existing row, writes nothing.
--  * cost > balance → raises 'INSUFFICIENT' (caller marks work paused).
--  * per-business advisory lock → two concurrent spends serialize; the second
--    sees the first's balance.
create or replace function public.spend_credits(
  p_business_id uuid,
  p_capability text,
  p_action_key text,
  p_cost integer,
  p_idempotency_key text,
  p_description text default null,
  p_result_ref text default null,
  p_approved_by uuid default null,
  p_actor_id uuid default null
)
returns public.credit_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.credit_transactions;
  bal integer;
  row_out public.credit_transactions;
begin
  if p_cost is null or p_cost < 0 then raise exception 'INVALID_COST'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) = 0 then raise exception 'IDEMPOTENCY_KEY_REQUIRED'; end if;

  select * into existing from public.credit_transactions where idempotency_key = p_idempotency_key;
  if found then return existing; end if;

  perform pg_advisory_xact_lock(hashtext('credits:' || p_business_id::text));

  -- Re-check after taking the lock (a concurrent identical request may have landed).
  select * into existing from public.credit_transactions where idempotency_key = p_idempotency_key;
  if found then return existing; end if;

  select coalesce(sum(amount), 0)::integer into bal from public.credit_transactions where business_id = p_business_id;
  if p_cost > bal then raise exception 'INSUFFICIENT' using detail = format('%s available, %s needed', bal, p_cost); end if;

  insert into public.credit_transactions (business_id, type, amount, balance_after, source, description, idempotency_key, actor_id, capability_key, action_key, result_ref, approved_by)
  values (p_business_id, 'USAGE', -p_cost, bal - p_cost, 'agent_action', p_description, p_idempotency_key, p_actor_id, nullif(p_capability, 'human'), p_action_key, p_result_ref, p_approved_by)
  returning * into row_out;
  return row_out;
end;
$$;
revoke all on function public.spend_credits(uuid, text, text, integer, text, text, text, uuid, uuid) from public, anon, authenticated;

-- get_credit_breakdown: the "132 / 150 + 40 top-up" numbers, derived from the
-- ledger (nothing stored). Monthly allotment spends first:
--   monthly_spent     = usage since the cycle started, capped at the allotment
--   monthly_remaining = allotment − monthly_spent
--   topup_balance     = total balance − monthly_remaining (never negative)
-- SECURITY INVOKER: runs under the caller's RLS, so a customer only sees their own.
create or replace function public.get_credit_breakdown(p_business_id uuid)
returns table (balance integer, allotment integer, monthly_spent integer, monthly_remaining integer, topup_balance integer, cycle_started_at timestamptz)
language sql
stable
security invoker
set search_path = public
as $$
  with b as (
    select coalesce(monthly_credit_allotment, 0) as allotment, credits_cycle_started_at from public.businesses where id = p_business_id
  ),
  tot as (
    select coalesce(sum(amount), 0)::integer as balance from public.credit_transactions where business_id = p_business_id
  ),
  used as (
    select coalesce(sum(-amount), 0)::integer as spent
    from public.credit_transactions t, b
    where t.business_id = p_business_id and t.type = 'USAGE' and (b.credits_cycle_started_at is null or t.created_at >= b.credits_cycle_started_at)
  )
  select
    tot.balance,
    b.allotment,
    least(used.spent, b.allotment) as monthly_spent,
    greatest(0, least(b.allotment - least(used.spent, b.allotment), tot.balance)) as monthly_remaining,
    greatest(0, tot.balance - greatest(0, least(b.allotment - least(used.spent, b.allotment), tot.balance))) as topup_balance,
    b.credits_cycle_started_at
  from b, tot, used;
$$;
grant execute on function public.get_credit_breakdown(uuid) to authenticated, service_role;
