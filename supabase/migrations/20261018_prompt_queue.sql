-- "Give HyperAgent" tab (Roman, 2026-10-18): the holding queue for everything Rome
-- needs to paste into HyperAgent. Cards are ordered by an explicit send_order
-- (urgency is a label only). Marking done moves a card to the Sent folder with a
-- timestamp; the Sent folder is append-only (no deletes — enforced by RLS: no
-- delete policy exists and the API never deletes a sent card).
create table if not exists public.prompt_cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt_text text not null,                     -- stored verbatim; rendered as plain text, never markdown
  urgency text not null default 'medium' check (urgency in ('high','medium','low')),
  send_order integer not null,                   -- explicit, editable; the only sort key for the queue
  status text not null default 'queued' check (status in ('queued','sent')),
  sent_at timestamptz,
  created_by uuid,                               -- user id (manual) or null (agent)
  created_by_label text not null,                -- "Roman Royce" / "Atlas (agent)"
  source text not null default 'manual' check (source in ('manual','agent')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prompt_cards_queue_idx on public.prompt_cards (status, send_order);
create index if not exists prompt_cards_sent_idx on public.prompt_cards (sent_at desc) where status = 'sent';

create table if not exists public.prompt_card_files (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.prompt_cards(id) on delete cascade,
  filename text not null,
  storage_path text not null,                    -- private bucket 'prompt-files'
  size_bytes integer not null default 0,
  mime_type text,
  created_at timestamptz not null default now()
);
create index if not exists prompt_card_files_card_idx on public.prompt_card_files (card_id);

insert into storage.buckets (id, name, public) values ('prompt-files', 'prompt-files', false) on conflict (id) do nothing;

alter table public.prompt_cards enable row level security;
alter table public.prompt_card_files enable row level security;
-- Team members read; all writes go through the API (service role) so the append-only rule for sent cards is enforced in one place.
drop policy if exists prompt_cards_team_read on public.prompt_cards;
create policy prompt_cards_team_read on public.prompt_cards for select to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.team_role is not null));
drop policy if exists prompt_card_files_team_read on public.prompt_card_files;
create policy prompt_card_files_team_read on public.prompt_card_files for select to authenticated using (exists (select 1 from public.users u where u.id = auth.uid() and u.team_role is not null));

-- Append-only history: a sent card can never be deleted or reverted past the 10-second undo window (enforced by API; this trigger is the backstop).
create or replace function public.prompt_cards_protect_sent() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'sent' then raise exception 'Sent prompts are append-only history and cannot be deleted'; end if;
    return old;
  end if;
  if old.status = 'sent' and new.status <> 'sent' and old.sent_at < now() - interval '15 seconds' then
    raise exception 'A sent prompt can only be undone within the undo window';
  end if;
  return new;
end $$;
drop trigger if exists prompt_cards_protect_sent on public.prompt_cards;
create trigger prompt_cards_protect_sent before update or delete on public.prompt_cards for each row execute function public.prompt_cards_protect_sent();
