-- A person tied to a business by an employment/representation/consulting relationship is not operating it.
-- Applied to production 2026-10-05 via supabase apply_migration (research_entity_associated_status).
alter table public.crm_research_results drop constraint if exists crm_research_results_business_status_check;
alter table public.crm_research_results add constraint crm_research_results_business_status_check check (business_status is null or business_status in ('BUSINESS','PERSON_OPERATING_BUSINESS','PERSON_ASSOCIATED_WITH_BUSINESS','BUSINESS_IDENTITY_UNCERTAIN','NO_BUSINESS_IDENTIFIED'));
