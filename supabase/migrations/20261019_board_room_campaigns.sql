-- Board Room (ideas, brainstorm sessions, votes) + Campaigns (tests, A/B variants). Team-only. 2026-10-19.
create table if not exists public.board_sessions (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.board_ideas (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.board_sessions(id) on delete set null,
  title text not null,
  description text,
  target_metric text,
  status text not null default 'draft' check (status in ('draft','ready','tested','killed')),
  plan jsonb,                         -- {what, who, success, duration_days, channels[], audience_tag}
  kill_reason text,
  killed_at timestamptz,
  decision text check (decision in ('scale','iterate','kill')),
  result_summary text,                -- pushed back from the completed campaign
  last_campaign_id uuid,
  parent_idea_id uuid references public.board_ideas(id) on delete set null, -- "iterate" copies
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists board_ideas_status on public.board_ideas (status, updated_at desc);
create index if not exists board_ideas_session on public.board_ideas (session_id);

create table if not exists public.board_votes (
  idea_id uuid not null references public.board_ideas(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid references public.board_ideas(id) on delete set null,
  name text not null,
  status text not null default 'draft' check (status in ('draft','running','paused','completed')),
  hypothesis text, audience text, success_criteria text, target_metric text, messaging text,
  channels text[] not null default '{}',
  audience_tag text,                  -- CRM lead tag that defines who is in the test (calls / meetings / deals)
  start_date date, end_date date,
  plan_snapshot jsonb,                -- the Board Room plan exactly as sent
  outcome text check (outcome in ('hit','missed','inconclusive')),
  result_notes text, result_metrics jsonb, winner_variant_id uuid,
  completed_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_status on public.campaigns (status, created_at desc);

create table if not exists public.campaign_variants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  name text not null,
  template_key text,                  -- outbound template used for this variant (preset key or saved:<id>) → sends/opens/replies
  lead_tag text,                      -- CRM tag for leads worked with this variant (call scripts) → calls/booked/won
  subject text, body text,            -- the variant's copy (a winner can become an outbound template)
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists campaign_variants_campaign on public.campaign_variants (campaign_id);

do $$ declare t text; begin
  foreach t in array array['board_sessions','board_ideas','board_votes','campaigns','campaign_variants'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I_team on public.%I', t, t);
    execute format('create policy %I_team on public.%I for all to authenticated using (is_team_member()) with check (is_team_member())', t, t);
  end loop;
end $$;
