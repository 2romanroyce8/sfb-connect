-- Content Lab Phase 1 (Trend Radar + Pattern Analyzer), 2026-10-19.
-- Owner-only. Read-only data from Instagram: no video processing, no posting.

create table if not exists public.content_lab_settings (
  id int primary key default 1 check (id = 1),
  niches jsonb not null default '[
    {"name":"AI tools","hashtags":["aitools","chatgpt","artificialintelligence"]},
    {"name":"Vibe coding","hashtags":["vibecoding","cursorai","aicoding"]},
    {"name":"Build in public","hashtags":["buildinpublic","indiehacker","solofounder"]}
  ]'::jsonb,
  ig_user_id text,
  ig_username text,
  hashtag_ids jsonb not null default '{}'::jsonb,      -- tag -> {id, first_used_at} (Meta: 30 unique hashtags / rolling 7 days)
  last_refresh_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
insert into public.content_lab_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.content_watch_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  niche text,
  active boolean not null default true,
  last_error text,
  created_at timestamptz not null default now()
);
create unique index if not exists content_watch_accounts_username on public.content_watch_accounts (lower(username));

create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  ig_media_id text not null unique,
  source text not null check (source in ('account','hashtag','own')),
  source_key text,               -- username or hashtag it was found through
  niche text,
  username text,
  permalink text,
  caption text,
  media_type text,
  posted_at timestamptz,
  like_count int,
  comments_count int,
  velocity numeric,              -- (likes+comments)/hour at last fetch
  hook text,
  hook_type text,
  cta_kind text,
  cta_keyword text,
  hashtags text[] not null default '{}',
  format text,
  format_tag text,               -- Rome's manual tag: talking_head | screen_recording | text_overlay | other
  first_seen_at timestamptz not null default now(),
  last_fetched_at timestamptz not null default now()
);
create index if not exists content_posts_rank on public.content_posts (posted_at desc, velocity desc);
create index if not exists content_posts_niche on public.content_posts (niche);

create table if not exists public.content_post_snapshots (
  id bigserial primary key,
  post_id uuid not null references public.content_posts(id) on delete cascade,
  like_count int, comments_count int,
  taken_at timestamptz not null default now()
);
create index if not exists content_post_snapshots_post on public.content_post_snapshots (post_id, taken_at desc);

alter table public.content_lab_settings enable row level security;
alter table public.content_watch_accounts enable row level security;
alter table public.content_posts enable row level security;
alter table public.content_post_snapshots enable row level security;
drop policy if exists content_lab_settings_owner on public.content_lab_settings;
create policy content_lab_settings_owner on public.content_lab_settings for all to authenticated using (is_team_owner()) with check (is_team_owner());
drop policy if exists content_watch_accounts_owner on public.content_watch_accounts;
create policy content_watch_accounts_owner on public.content_watch_accounts for all to authenticated using (is_team_owner()) with check (is_team_owner());
drop policy if exists content_posts_owner on public.content_posts;
create policy content_posts_owner on public.content_posts for all to authenticated using (is_team_owner()) with check (is_team_owner());
drop policy if exists content_post_snapshots_owner on public.content_post_snapshots;
create policy content_post_snapshots_owner on public.content_post_snapshots for select to authenticated using (is_team_owner());
