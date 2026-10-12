-- Secondary niche tags from the build-show classifier (e.g. community → coaching, education). 2026-10-11.
alter table public.businesses add column if not exists niche_tags text[] not null default '{}';
