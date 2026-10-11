-- Client project graph (2026-10-11). Internal view /team/projects now; client
-- mirror after Phase 2. Distinct from the legacy `projects` (audit scans).
-- Client space = a businesses row with a plan_key. Node positions live on the
-- project (jsonb {nodeId: {x, y}}); null/missing = auto-layout.

create table if not exists public.client_projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  status text not null default 'active' check (status in ('active','paused','done')),
  summary text,
  positions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_projects_business_idx on public.client_projects(business_id, created_at desc);

create table if not exists public.client_project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'planned' check (status in ('planned','in_progress','in_review','done','blocked')),
  assignees uuid[] not null default '{}',            -- team users
  tech_stack text[] not null default '{}',
  internal_note text,                                -- internal-only: never sent to the client view
  client_approval text not null default 'not_requested' check (client_approval in ('not_requested','pending','approved','rejected')),
  client_approval_note text,
  client_approved_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_project_tasks_project_idx on public.client_project_tasks(project_id, sort_order);

create table if not exists public.client_project_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.client_project_tasks(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  assignees uuid[] not null default '{}',
  tech_stack text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_project_subtasks_task_idx on public.client_project_subtasks(task_id, sort_order);

create table if not exists public.client_project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  task_id uuid references public.client_project_tasks(id) on delete cascade,
  body text not null,
  author_kind text not null check (author_kind in ('client','team')),
  author_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_project_notes_project_idx on public.client_project_notes(project_id, created_at desc);

create table if not exists public.client_project_roles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  task_id uuid references public.client_project_tasks(id) on delete cascade,
  role_title text not null,                          -- "Project Manager"
  person_user_id uuid references auth.users(id) on delete set null,
  person_name text,                                  -- when not a team user
  blurb text,                                        -- "Managing project progress"
  tech_stack text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_project_roles_project_idx on public.client_project_roles(project_id, sort_order);

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['client_projects','client_project_tasks','client_project_subtasks','client_project_notes','client_project_roles'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop; end $$;

-- RLS: team members read everything; the client (business owner) reads their own
-- project rows EXCEPT internal fields, which the client API never selects. Writes
-- go through the service role in the API (team CRUD now; client notes/approvals later).
alter table public.client_projects enable row level security;
alter table public.client_project_tasks enable row level security;
alter table public.client_project_subtasks enable row level security;
alter table public.client_project_notes enable row level security;
alter table public.client_project_roles enable row level security;

drop policy if exists client_projects_read on public.client_projects;
create policy client_projects_read on public.client_projects for select to authenticated
  using (public.is_team_member() or exists (select 1 from public.businesses b where b.id = client_projects.business_id and b.owner_id = auth.uid()));
drop policy if exists client_project_tasks_read on public.client_project_tasks;
create policy client_project_tasks_read on public.client_project_tasks for select to authenticated
  using (public.is_team_member() or exists (select 1 from public.client_projects p join public.businesses b on b.id = p.business_id where p.id = client_project_tasks.project_id and b.owner_id = auth.uid()));
drop policy if exists client_project_subtasks_read on public.client_project_subtasks;
create policy client_project_subtasks_read on public.client_project_subtasks for select to authenticated
  using (public.is_team_member() or exists (select 1 from public.client_project_tasks t join public.client_projects p on p.id = t.project_id join public.businesses b on b.id = p.business_id where t.id = client_project_subtasks.task_id and b.owner_id = auth.uid()));
drop policy if exists client_project_notes_read on public.client_project_notes;
create policy client_project_notes_read on public.client_project_notes for select to authenticated
  using (public.is_team_member() or exists (select 1 from public.client_projects p join public.businesses b on b.id = p.business_id where p.id = client_project_notes.project_id and b.owner_id = auth.uid()));
drop policy if exists client_project_roles_read on public.client_project_roles;
create policy client_project_roles_read on public.client_project_roles for select to authenticated
  using (public.is_team_member() or exists (select 1 from public.client_projects p join public.businesses b on b.id = p.business_id where p.id = client_project_roles.project_id and b.owner_id = auth.uid()));
