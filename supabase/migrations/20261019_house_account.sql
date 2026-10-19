-- SFB Connect's own business (the outbound email sender) is not a client.
-- Flag it so Revenue (MRR / active clients) excludes it. Applied 2026-10-19.
alter table public.businesses add column if not exists is_house_account boolean not null default false;
comment on column public.businesses.is_house_account is 'SFB Connect''s own business (outbound sender). Excluded from MRR / active clients. 2026-10-19';
update public.businesses set legal_name = 'SFB Connect', is_house_account = true, updated_at = now() where id = 'edd6001d-1243-4353-b107-3224f7c0ad49';
