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
create table if not exists public.projects (
  id uuid primary key default uuid_generate_v4(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  status text not null default 'submitted'
    check (status in ('submitted','analyzing','researching','optimizing','final_review','completed')),
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
-- AUDITS
-- ============================================================
create table if not exists public.audits (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  audit_stage text not null default 'intake'
    check (audit_stage in ('intake','presence_audit','competitive_analysis','knowledge_optimization','presence_build','report')),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.audit_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique
);

create table if not exists public.audit_findings (
  id uuid primary key default uuid_generate_v4(),
  audit_id uuid not null references public.audits(id) on delete cascade,
  category_id uuid references public.audit_categories(id),
  severity text check (severity in ('info','minor','moderate','critical')) default 'info',
  finding text not null,
  recommendation text,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRESENCE SCORES
-- ============================================================
create table if not exists public.presence_scores (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  overall_score integer not null check (overall_score between 0 and 100),
  identity_score integer check (identity_score between 0 and 100),
  knowledge_score integer check (knowledge_score between 0 and 100),
  authority_score integer check (authority_score between 0 and 100),
  location_score integer check (location_score between 0 and 100),
  machine_readability_score integer check (machine_readability_score between 0 and 100),
  recorded_at timestamptz not null default now()
);

create table if not exists public.recommendations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  priority text check (priority in ('low','medium','high')) default 'medium',
  status text check (status in ('pending','in_progress','done')) default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================================
-- REPORTS
-- ============================================================
create table if not exists public.reports (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
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
alter table public.audits enable row level security;
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

-- users: self read/update, admin full read
create policy "users_self_select" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "users_self_update" on public.users for update using (id = auth.uid());

-- businesses: owner or admin
create policy "businesses_owner_all" on public.businesses for all
  using (owner_id = auth.uid() or public.is_admin());

-- child tables scoped through business ownership
create policy "locations_owner_all" on public.business_locations for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "services_owner_all" on public.business_services for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "social_owner_all" on public.business_social_profiles for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "competitors_owner_all" on public.competitors for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));

create policy "projects_owner_all" on public.projects for all
  using (exists (select 1 from public.businesses b where b.id = business_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "status_history_owner_read" on public.project_status_history for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "status_history_admin_write" on public.project_status_history for insert
  with check (public.is_admin());

create policy "audits_owner_read" on public.audits for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "audits_admin_write" on public.audits for insert with check (public.is_admin());
create policy "audits_admin_update" on public.audits for update using (public.is_admin());

create policy "findings_owner_read" on public.audit_findings for select
  using (exists (select 1 from public.audits a join public.projects p on p.id = a.project_id join public.businesses b on b.id = p.business_id where a.id = audit_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "findings_admin_write" on public.audit_findings for all using (public.is_admin());

create policy "scores_owner_read" on public.presence_scores for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "scores_admin_write" on public.presence_scores for insert with check (public.is_admin());

create policy "recs_owner_read" on public.recommendations for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
create policy "recs_admin_write" on public.recommendations for all using (public.is_admin());

create policy "reports_owner_read" on public.reports for select
  using (exists (select 1 from public.projects p join public.businesses b on b.id = p.business_id where p.id = project_id and (b.owner_id = auth.uid() or public.is_admin())));
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
