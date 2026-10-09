-- SFB Agent product: tiers Trial/Solo/Agency, 8 capabilities, trial sandbox, credit accounting fields.
alter table public.businesses
  add column if not exists is_sandbox boolean not null default false,
  add column if not exists stock_profile_key text,
  add column if not exists trial_expires_at timestamptz,
  add column if not exists monthly_credit_allotment integer not null default 0,
  add column if not exists credits_cycle_started_at timestamptz,
  add column if not exists work_paused_reason text;
create table if not exists public.business_capabilities (
  business_id uuid not null references public.businesses(id) on delete cascade,
  capability_key text not null,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (business_id, capability_key)
);
alter table public.business_capabilities enable row level security;
drop policy if exists business_capabilities_owner_rw on public.business_capabilities;
create policy business_capabilities_owner_rw on public.business_capabilities for all to authenticated
  using (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid()));
drop policy if exists business_capabilities_team_read on public.business_capabilities;
create policy business_capabilities_team_read on public.business_capabilities for select to authenticated using (is_team_member());
alter table public.credit_transactions add column if not exists capability_key text, add column if not exists action_key text;
delete from public.agent_program_modules where key not in ('ai_presence','outbound_gtm','meta_ads','website','crm_automations','chat_texting','reviews_reputation','sops');
insert into public.agent_program_modules (key, position, name, status, tagline, description) values
 ('ai_presence', 1, 'AI Presence', 'live', 'Found first, chosen first.', 'Your business recommended by ChatGPT, Perplexity, Gemini and Claude — presence score, verified sources, review signals.'),
 ('outbound_gtm', 2, 'Outbound / GTM', 'unlocking_next', 'Finds buyers, books calls.', 'Finds buyers, enriches them, writes and follows up, and books calls — email and LinkedIn.'),
 ('meta_ads', 3, 'Meta Ads', 'roadmap', 'Managed for return.', 'Paid ads managed for ROAS: creative testing, retargeting, full-funnel.'),
 ('website', 4, 'Website', 'roadmap', 'Convert the traffic you earn.', 'Homepage, speed, payments, backlinks, SEO.'),
 ('crm_automations', 5, 'CRM + Automations', 'roadmap', 'Never forget a lead.', 'Pipeline, follow-up, reminders, missed-call textback — GoHighLevel-friendly.'),
 ('chat_texting', 6, 'Chat & Texting', 'roadmap', 'Answers, qualifies, books.', 'Website chat and SMS agent that qualifies and books.'),
 ('reviews_reputation', 7, 'Reviews & Reputation', 'roadmap', 'Earn it, watch it, answer it.', 'Review generation, monitoring and responses.'),
 ('sops', 8, 'SOPs', 'roadmap', 'Your operations, documented.', 'Operations documentation — the playbook your business runs on.')
on conflict (key) do update set position = excluded.position, name = excluded.name, tagline = excluded.tagline, description = excluded.description;
update public.credit_packages set active = false where name not in ('100 Credits','500 Credits','1,000 Credits');
insert into public.credit_packages (name, credits, price_cents, active, sort_order) values ('100 Credits', 100, 14900, true, 1), ('500 Credits', 500, 59900, true, 2), ('1,000 Credits', 1000, 99900, true, 3) on conflict do nothing;
alter table public.agent_plan_orders drop constraint if exists agent_plan_orders_plan_key_check;
alter table public.agent_plan_orders add constraint agent_plan_orders_plan_key_check check (plan_key in ('solo','agency','agent_starter','agent_growth','agent_scale'));
