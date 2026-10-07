alter table public.users add column if not exists is_primary_owner boolean not null default false;
update public.users set is_primary_owner = true where id = 'a7398ad8-40f3-4c71-b0a5-308e1027348c';
create unique index if not exists users_single_primary_owner on public.users ((true)) where is_primary_owner;

-- The primary owner (founder account) cannot be deleted, demoted, disabled,
-- re-emailed or stripped of the flag by ANY path -- API, service role, or
-- another owner. Triggers run even for the service role, unlike RLS.
create or replace function public.protect_primary_owner() returns trigger language plpgsql security definer as $$
begin
  if tg_op = 'DELETE' then
    if old.is_primary_owner then raise exception 'The primary owner account cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.is_primary_owner then
    if new.is_primary_owner is distinct from true then raise exception 'The primary owner flag cannot be removed.' using errcode = '42501'; end if;
    if new.team_role is distinct from 'owner' then raise exception 'The primary owner cannot be demoted.' using errcode = '42501'; end if;
    if new.team_status is distinct from 'active' then raise exception 'The primary owner cannot be deactivated.' using errcode = '42501'; end if;
    if new.email is distinct from old.email then raise exception 'The primary owner email cannot be changed here.' using errcode = '42501'; end if;
  elsif new.is_primary_owner and not old.is_primary_owner then
    raise exception 'Primary ownership cannot be reassigned.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists protect_primary_owner_trg on public.users;
create trigger protect_primary_owner_trg before update or delete on public.users for each row execute function public.protect_primary_owner();

-- Same guarantee at the auth layer: no delete, no ban, no email change for the primary owner's auth record.
create or replace function public.protect_primary_owner_auth() returns trigger language plpgsql security definer set search_path = public as $$
declare primary_id uuid;
begin
  select id into primary_id from public.users where is_primary_owner limit 1;
  if tg_op = 'DELETE' then
    if old.id = primary_id then raise exception 'The primary owner auth account cannot be deleted.' using errcode = '42501'; end if;
    return old;
  end if;
  if old.id = primary_id then
    if new.banned_until is not null and (old.banned_until is null or new.banned_until > now()) then raise exception 'The primary owner cannot be banned.' using errcode = '42501'; end if;
    if new.email is distinct from old.email then raise exception 'The primary owner auth email cannot be changed.' using errcode = '42501'; end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_primary_owner_auth_trg on auth.users;
create trigger protect_primary_owner_auth_trg before update or delete on auth.users for each row execute function public.protect_primary_owner_auth();
