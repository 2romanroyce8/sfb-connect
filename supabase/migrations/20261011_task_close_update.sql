-- Task tools for Atlas: close_task / update_task (2026-10-11).
-- 'closed' is an administrative close, distinct from 'done' (which the
-- agent_tasks_guard trigger reserves for reviewed work). closed_by/closed_at
-- record who closed and when; the reason goes on the task thread.
alter table public.agent_tasks drop constraint if exists agent_tasks_status_check;
alter table public.agent_tasks add constraint agent_tasks_status_check
  check (status in ('open','claimed','in_progress','in_review','done','rejected','blocked','canceled','closed'));
alter table public.agent_tasks
  add column if not exists closed_by text,
  add column if not exists closed_at timestamptz;
