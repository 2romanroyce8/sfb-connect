-- SFB Agent program: the six modules and their public status. Statuses are
-- data, not code, so the owner changes them from Settings without a deploy.
create table if not exists public.agent_program_modules (
  key text primary key,
  position integer not null,
  name text not null,
  status text not null default 'roadmap' check (status in ('live','unlocking_next','roadmap')),
  tagline text not null,
  description text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.agent_program_modules enable row level security;
drop policy if exists agent_program_modules_public_read on public.agent_program_modules;
create policy agent_program_modules_public_read on public.agent_program_modules for select to anon, authenticated using (true);
drop policy if exists agent_program_modules_owner_write on public.agent_program_modules;
create policy agent_program_modules_owner_write on public.agent_program_modules for update to authenticated using (is_team_owner()) with check (is_team_owner());

insert into public.agent_program_modules (key, position, name, status, tagline, description) values
 ('ai_presence', 1, 'AI Presence', 'live', 'Found first, chosen first.', 'Gets your business recommended by AI assistants — presence score, verified sources, review signals.'),
 ('chat_agent', 2, 'Chat Agent', 'unlocking_next', 'Answers, qualifies, books.', 'AI texting and website chat that answers customers, qualifies leads and books appointments.'),
 ('crm_automations', 3, 'Backend: CRM + Automations', 'roadmap', 'Never forget a lead.', 'Every lead captured, followed up and never forgotten — pipeline, reminders, review requests.'),
 ('website', 4, 'Website', 'roadmap', 'Convert the traffic you earn.', 'Homepage, speed, payments, backlinks — a site that converts the traffic the agent earns.'),
 ('meta_ads', 5, 'Meta Ads (ROAS)', 'roadmap', 'Paid reach, measured by return.', 'Paid ads managed for return, with creative testing and retargeting.'),
 ('sops', 6, 'SOPs', 'roadmap', 'Your operations, documented.', 'The playbook your business runs on — written down, kept current.')
on conflict (key) do nothing;

-- Which human oversees a customer business's agent. Null until onboarding assigns one.
alter table public.businesses add column if not exists agent_overseer_id uuid references public.users(id) on delete set null;
