-- SFB Connect — Database Schema
-- Run in Supabase SQL editor. Assumes Supabase Auth is enabled (auth.users exists).

create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (profile row linked 1:1 to auth.users)
-- ============================================================
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Auto-create a public.users profile row the moment someone signs up via
-- Supabase Auth (on /pay or /login), rather than only when the onboarding
-- API route upserts one after a confirmed payment. Without this, there is
-- no way to bootstrap the very first admin account — you'd need a
-- public.users row to exist before you could set role = 'admin' on it.
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================
-- BUSINESSES
-- ============================================================
create table if not exists public.businesses (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.users(id) on delete cascade,
  legal_name text not null,
  website text,
  primary_category text,
  description text,
  years_in_business text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_locations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary_address text,
  service_areas text[],
  cities text[],
  states text[],
  radius_miles integer,
  created_at timestamptz not null default now()
);

create table if not exists public.business_services (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary_service text,
  additional_services text[],
  specialties text[],
  price_range text,
  ideal_customer text,
  created_at timestamptz not null default now()
);

create table if not exists public.business_social_profiles (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  google_business_profile_url text,
  facebook text,
  instagram text,
  tiktok text,
  linkedin text,
  youtube text,
  other_directories text[],
  created_at timestamptz not null default now()
);

create table if not exists public.competitors (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  website text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PROJECTS (one annual engagement per business)
-- ============================================================
-- A single SFB analysis/scan run for a business (NOT a customer-facing
-- "project" -- reframed 2026-09-19 from a one-time 14-day managed-audit
-- engagement into a reusable, repeatable scan run; a paying customer
-- accumulates many of these over their lifetime).
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','running','completed','failed')),
  scan_type text not null default 'manual'
    check (scan_type in ('baseline','visibility_check','competitor_scan','knowledge_audit','website_ai_readiness','scheduled_monitoring','manual')),
  location_id uuid references public.business_locations(id),
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  target_completion_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_status_history (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null,
  note text,
  changed_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUDITS -- RETIRED 2026-09-19. The `audits` workflow-stage intermediary
-- table (tied to the old 14-day managed-audit model) was dropped; findings
-- attach directly to project_id + business_id now. audit_categories is
-- kept (a real, still-useful 20-item taxonomy).
-- ============================================================
create table if not exists public.audit_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

-- Individual AI-presence findings, attached directly to a business + the
-- scan run that produced them (no longer indirected through `audits`).
create table if not exists public.audit_findings (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  project_id uuid not null references public.projects(id),
  location_id uuid references public.business_locations(id),
  category_id uuid references public.audit_categories(id),
  platform text check (platform is null or platform in ('aggregate','chatgpt','claude','perplexity','grok','google_ai','website')),
  query_text text,
  evidence_text text,
  severity text check (severity in ('info','minor','moderate','critical')) default 'info',
  finding text not null,
  recommendation text,
  resolved boolean not null default false,
  resolved_at timestamptz,
  resolved_by uuid references public.users(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRESENCE SCORES -- historical AI-presence measurements. business_id is
-- denormalized directly so RLS/queries never need to go through projects.
-- Scores computed under different methodology_version values are never
-- directly comparable -- never diff across versions.
-- ============================================================
create table if not exists public.presence_scores (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  project_id uuid not null references public.projects(id) on delete cascade,
  location_id uuid references public.business_locations(id),
  platform text check (platform is null or platform in ('aggregate','chatgpt','claude','perplexity','grok','google_ai')),
  methodology_version text not null default 'v1',
  overall_score integer not null check (overall_score between 0 and 100),
  identity_score integer check (identity_score between 0 and 100),
  knowledge_score integer check (knowledge_score between 0 and 100),
  authority_score integer check (authority_score between 0 and 100),
  location_score integer check (location_score between 0 and 100),
  machine_readability_score integer check (machine_readability_score between 0 and 100),
  recorded_at timestamptz not null default now()
);

-- SFB-authored "you should do this based on intelligence" action items --
-- distinct from expansion_opportunities (commercial expansion) and
-- action_catalog (executable credit-metered work). May reference the
-- specific finding that generated it.
create table if not exists public.recommendations (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  project_id uuid references public.projects(id),
  finding_id uuid references public.audit_findings(id),
  location_id uuid references public.business_locations(id),
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high')) default 'medium',
  status text check (status in ('pending','in_progress','done')) default 'pending',
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- REPORTS -- real generated customer deliverables.
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  project_id uuid references public.projects(id),
  location_id uuid references public.business_locations(id),
  report_type text check (report_type is null or report_type in ('initial','monthly','quarterly','competitor','ai_visibility','website_ai_readiness','knowledge_coverage')),
  period_start date,
  period_end date,
  file_url text,
  summary text,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS / MEMBERSHIP
-- Manual proof-of-payment flow: Cash App, PayPal, and Zelle have no
-- programmatic webhook a merchant can subscribe to for one-off P2P-style
-- payments, so every payment is submitted by the customer with a unique
-- reference code and confirmed by an admin against the actual Cash App /
-- PayPal / Zelle account before it unlocks onboarding.
-- ============================================================
create table if not exists public.payments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid references public.businesses(id),
  method text not null check (method in ('cashapp', 'paypal', 'zelle')),
  reference_code text not null unique,
  amount_cents integer not null default 20000,
  currency text not null default 'usd',
  customer_note text,
  proof_screenshot_url text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'confirmed', 'rejected')),
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

-- LOGICALLY RETIRED 2026-09-19. businesses.plan_key + the entitlement
-- engine (lib/billing/entitlements.ts) is now the SOLE authority for
-- "is this a paid customer" -- this table must never be used for
-- access/plan/billing/renewal/entitlement/portal-state decisions again.
-- It has zero writers as of this commit (the one writer, /api/onboarding,
-- was removed as part of closing a free-self-granted-membership
-- vulnerability) and its one remaining reader is being removed from
-- lib/customerPortal during this same pass. NOT physically dropped yet --
-- keep the table until the new customer portal has shipped and passed
-- regression testing, then drop it.
create table if not exists public.subscriptions_or_annual_memberships (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  payment_id uuid references public.payments(id),
  status text not null default 'active' check (status in ('active','expired','canceled')),
  started_at timestamptz not null default now(),
  renews_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SUPPORT / ADMIN NOTES
-- ============================================================
create table if not exists public.support_messages (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer','admin')),
  sender_id uuid references public.users(id),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_notes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid references public.users(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AI VISIBILITY MONITORING + INTELLIGENCE ENGINE V1 (2026-09-19)
-- NOTE: ai_visibility_observations, action_catalog, and the rest of the
-- billing/entitlement schema (customer_addons, credit_transactions, etc.)
-- were created via migrations applied directly to the live DB and are NOT
-- yet reflected as CREATE TABLE statements in this file -- a pre-existing
-- drift issue from an earlier build pass, not introduced here. Only the
-- two NEW tables from this pass are added below for now.
-- ============================================================
create table if not exists public.tracked_queries (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id),
  location_id uuid references public.business_locations(id),
  query_text text not null,
  normalized_query text not null,
  query_type text not null check (query_type in ('discovery','service','local','comparison','brand','competitor')),
  category text,
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'active' check (status in ('active','paused','archived')),
  source text not null check (source in ('system_generated','research_discovered','team_added','customer_added')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists idx_tracked_queries_dedupe on public.tracked_queries(business_id, normalized_query, coalesce(location_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.ai_check_jobs (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id),
  tracked_query_id uuid not null references public.tracked_queries(id),
  platform text not null check (platform in ('chatgpt','claude','perplexity','grok','google_ai')),
  competitor_id uuid references public.competitors(id),
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped_not_configured')),
  attempt_count integer not null default 0,
  error_text text,
  cost_estimate_cents numeric,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create unique index if not exists idx_ai_check_jobs_identity on public.ai_check_jobs(project_id, tracked_query_id, platform, coalesce(competitor_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.tracked_queries enable row level security;
alter table public.ai_check_jobs enable row level security;
create policy "tracked_queries_owner_read" on public.tracked_queries for select
  using (exists (select 1 from public.businesses b where b.id = tracked_queries.business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "tracked_queries_team_owner_all" on public.tracked_queries for all using (public.is_team_owner());
create policy "ai_check_jobs_team_owner_all" on public.ai_check_jobs for all using (public.is_team_owner());

-- competitors: distinguish customer-entered from AI-discovered (existing
-- rows are all customer-entered -- default preserves that truthfully).
alter table public.competitors add column if not exists source text not null default 'customer_entered' check (source in ('customer_entered','ai_discovered'));
alter table public.competitors add column if not exists discovered_at timestamptz;
alter table public.competitors add column if not exists verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','dismissed'));

-- audit_findings: dedup/lifecycle key so the engine never opens the same
-- finding twice for one business.
alter table public.audit_findings add column if not exists finding_key text;
create unique index if not exists idx_audit_findings_dedupe_key on public.audit_findings(business_id, finding_key) where finding_key is not null;

alter table public.recommendations add column if not exists auto_generated boolean not null default false;

-- ============================================================
-- LEADS (pre-checkout capture)
-- ============================================================
create table if not exists public.leads (
  id uuid primary key default uuid_generate_v4(),
  business_name text,
  website text,
  category text,
  city text,
  state text,
  owner_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.users enable row level security;
alter table public.businesses enable row level security;
alter table public.business_locations enable row level security;
alter table public.business_services enable row level security;
alter table public.business_social_profiles enable row level security;
alter table public.competitors enable row level security;
alter table public.projects enable row level security;
alter table public.project_status_history enable row level security;
alter table public.audit_findings enable row level security;
alter table public.presence_scores enable row level security;
alter table public.recommendations enable row level security;
alter table public.reports enable row level security;
alter table public.payments enable row level security;
alter table public.subscriptions_or_annual_memberships enable row level security;
alter table public.support_messages enable row level security;
alter table public.admin_notes enable row level security;

-- helper: is the current user an admin?
create or replace function public.is_admin() returns boolean as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- users: self read/update, admin full read. NOTE: `role` can never be
-- changed by a client session regardless of this policy -- see
-- prevent_client_role_change() trigger below (added 2026-09-19 after an
-- audit found this policy's missing WITH CHECK let a user self-update
-- their own role to 'admin').
create policy "users_self_select" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users_self_update" on public.users for update using (id = auth.uid());

create or replace function public.prevent_client_role_change()
returns trigger
language plpgsql
as $$
begin
  if new.role is distinct from old.role and current_user <> 'service_role' then
    raise exception 'role cannot be changed directly by a client session';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_client_role_change on public.users;
create trigger trg_prevent_client_role_change
  before update on public.users
  for each row execute function public.prevent_client_role_change();

-- businesses: SELECT-only for the owner (fixed 2026-09-19 -- the original
-- FOR ALL policy here had no separate WITH CHECK, which let any customer
-- INSERT/UPDATE their own plan_key directly via the browser client with no
-- payment). All writes now go through service-role-backed API routes.
create policy "businesses_owner_read" on public.businesses for select
  using (owner_id = auth.uid() or public.is_admin());
-- businesses_team_owner_all (is_team_owner(), all) is defined in the
-- addon_billing_credits_entitlements migration, not duplicated here.

-- child tables scoped through business ownership
create policy "locations_owner_all" on public.business_locations for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "services_owner_all" on public.business_services for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "social_owner_all" on public.business_social_profiles for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "competitors_owner_all" on public.competitors for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

-- projects: SELECT-only for the owner (fixed 2026-09-19, same class of fix
-- as businesses -- a customer must not be able to fabricate/alter their
-- own scan-run records). Admin writes via a separate ALL policy.
create policy "projects_owner_read" on public.projects for select
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "projects_admin_all" on public.projects for all using (public.is_admin());

create policy "status_history_owner_read" on public.project_status_history for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "status_history_admin_write" on public.project_status_history for insert
  with check (public.is_admin());

-- audit_findings/presence_scores/recommendations/reports: simplified
-- 2026-09-19 to use the direct business_id column added in the domain
-- migration, instead of a 3-table join through the (now-retired for
-- findings) audits/projects chain.
create policy "findings_owner_read" on public.audit_findings for select
  using (exists (select 1 from public.businesses b where b.id = audit_findings.business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "findings_admin_write" on public.audit_findings for all using (public.is_admin());

create policy "scores_owner_read" on public.presence_scores for select
  using (exists (select 1 from public.businesses b where b.id = presence_scores.business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "scores_admin_write" on public.presence_scores for insert with check (public.is_admin());

create policy "recs_owner_read" on public.recommendations for select
  using (exists (select 1 from public.businesses b where b.id = recommendations.business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "recs_admin_write" on public.recommendations for all using (public.is_admin());

create policy "reports_owner_read" on public.reports for select
  using (exists (select 1 from public.businesses b where b.id = reports.business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "reports_admin_write" on public.reports for all using (public.is_admin());

create policy "payments_owner_read" on public.payments for select using (user_id = auth.uid() or public.is_admin());
create policy "payments_owner_insert" on public.payments for insert with check (user_id = auth.uid());
create policy "payments_owner_update_own_pending" on public.payments for update
  using (user_id = auth.uid() and status = 'pending_review');
create policy "payments_admin_update" on public.payments for update using (public.is_admin());

create policy "memberships_owner_read" on public.subscriptions_or_annual_memberships for select
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "support_owner_all" on public.support_messages for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "admin_notes_admin_only" on public.admin_notes for all using (public.is_admin());

-- Seed audit categories (matches "What We Analyze")
insert into public.audit_categories (name) values
  ('Business entity clarity'), ('Name / address / phone consistency'), ('Service definitions'),
  ('Product definitions'), ('Geographic relevance'), ('Website information architecture'),
  ('Structured data'), ('Schema markup'), ('Business descriptions'), ('Public citations'),
  ('Social profiles'), ('Review signals'), ('Authority signals'), ('Knowledge consistency'),
  ('Frequently asked questions'), ('AI-readable service information'), ('Local business information'),
  ('Source freshness'), ('Competitive positioning'), ('Entity relationships')
on conflict (name) do nothing;
