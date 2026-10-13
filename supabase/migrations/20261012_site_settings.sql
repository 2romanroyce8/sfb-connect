-- Homepage "Watch it work" video (Roman, 2026-10-12, launch-list A4). Roman
-- uploads the walkthrough himself; until a URL is set the section shows an
-- honest "coming" state (never a mockup). One row, owner-editable.
create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  walkthrough_video_url text,
  walkthrough_poster_url text,
  updated_by uuid,
  updated_at timestamptz not null default now()
);
insert into public.site_settings (id) values (1) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists site_settings_owner_read on public.site_settings;
create policy site_settings_owner_read on public.site_settings for select to authenticated using (is_team_owner());
-- writes: service role via /api/team/site-settings (owner-gated in code)

-- Public bucket for site media (the video file itself). Owners upload from /team/settings; everyone can read.
insert into storage.buckets (id, name, public) values ('site-media', 'site-media', true) on conflict (id) do nothing;
drop policy if exists site_media_public_read on storage.objects;
create policy site_media_public_read on storage.objects for select using (bucket_id = 'site-media');
drop policy if exists site_media_owner_insert on storage.objects;
create policy site_media_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'site-media' and is_team_owner());
drop policy if exists site_media_owner_update on storage.objects;
create policy site_media_owner_update on storage.objects for update to authenticated using (bucket_id = 'site-media' and is_team_owner());
drop policy if exists site_media_owner_delete on storage.objects;
create policy site_media_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'site-media' and is_team_owner());
