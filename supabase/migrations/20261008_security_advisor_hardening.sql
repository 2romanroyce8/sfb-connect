-- 1. The one ERROR: stripe_webhook_events had no RLS. It is written only by the
-- Stripe webhook route through the service role (idempotency ledger), so RLS
-- with no user policies is the correct state: service role bypasses RLS,
-- anon/authenticated get nothing.
alter table public.stripe_webhook_events enable row level security;

-- 2. Pin search_path on SECURITY DEFINER / trigger functions (search-path hijack hardening).
alter function public.handle_new_auth_user() set search_path = public;
alter function public.is_admin() set search_path = public;
alter function public.is_team_owner() set search_path = public;
alter function public.is_team_member() set search_path = public;
alter function public.get_credit_balance(uuid) set search_path = public;
alter function public.prevent_client_role_change() set search_path = public;
alter function public.protect_primary_owner() set search_path = public;

-- 3. Trigger functions and internal helpers must not be callable over the REST RPC surface at all.
revoke execute on function public.handle_new_auth_user() from anon, authenticated, public;
revoke execute on function public.protect_primary_owner() from anon, authenticated, public;
revoke execute on function public.protect_primary_owner_auth() from anon, authenticated, public;
revoke execute on function public.prevent_client_role_change() from anon, authenticated, public;
revoke execute on function public.is_admin() from anon, public;
revoke execute on function public.is_team_owner() from anon, public;
revoke execute on function public.is_team_member() from anon, public;
-- App code calls these two with a signed-in user; anonymous callers never should.
revoke execute on function public.expire_stale_research_jobs() from anon, public;
revoke execute on function public.get_leaderboard(timestamptz, timestamptz) from anon, public;
