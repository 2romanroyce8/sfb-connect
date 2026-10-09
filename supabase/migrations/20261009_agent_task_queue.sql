-- Agent task queue: how Atlas (Muse) and HyperAgent hand work to each other
-- without a human relay. Review is ENFORCED here, not by convention: a task
-- flagged requires_review can only reach 'done' through review_task by an
-- agent other than the one that did the work (the trigger refuses anything
-- else), and the review verdict is recorded.
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_agent text not null,
  status text not null default 'open' check (status in ('open','claimed','in_progress','in_review','done','rejected','blocked','canceled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due timestamptz,
  context text,
  result text,
  evidence_links text[] not null default '{}',
  requires_review boolean not null default true,
  reviewer_agent text,
  review_verdict text check (review_verdict in ('approved','changes_requested','rejected')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_by text not null,
  claimed_by text,
  claimed_at timestamptz,
  result_posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists agent_tasks_owner_status_idx on public.agent_tasks(owner_agent, status, priority);
create table if not exists public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.agent_tasks(id) on delete cascade,
  from_agent text not null,
  to_agent text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists agent_messages_task_idx on public.agent_messages(task_id, created_at);
alter table public.agent_tasks enable row level security;
alter table public.agent_messages enable row level security;
drop policy if exists agent_tasks_team_read on public.agent_tasks;
create policy agent_tasks_team_read on public.agent_tasks for select to authenticated using (is_team_member());
drop policy if exists agent_messages_team_read on public.agent_messages;
create policy agent_messages_team_read on public.agent_messages for select to authenticated using (is_team_member());
create or replace function public.agent_tasks_guard() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.status = 'done' and old.status is distinct from 'done' then
      if new.requires_review then
        if new.review_verdict is distinct from 'approved' then
          raise exception 'This task requires review: post_result moves it to in_review, and only review_task(approved) can mark it done.' using errcode = '42501';
        end if;
        if new.reviewed_by is null or new.reviewed_by = coalesce(new.claimed_by, new.owner_agent) then
          raise exception 'A task cannot be approved by the agent that did the work.' using errcode = '42501';
        end if;
      end if;
    end if;
    if new.review_verdict is not null and new.reviewed_by is null then
      raise exception 'review verdict requires reviewed_by' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists agent_tasks_guard_trg on public.agent_tasks;
create trigger agent_tasks_guard_trg before insert or update on public.agent_tasks for each row execute function public.agent_tasks_guard();
update public.agent_authorizations set scopes = array_append(scopes, 'sfb:tasks') where status = 'active' and not ('sfb:tasks' = any(scopes)) and client_id in (select client_id from public.agent_clients where client_name in ('Muse','Hyperagent'));
