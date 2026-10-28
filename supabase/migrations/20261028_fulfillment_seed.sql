-- Platform service catalog (agency_id null). Names and plain descriptions only; NO prices.
insert into public.agy_services(agency_id,key,name,description) values
(null,'ai_voice_receptionist','AI voice receptionist','Answers calls, handles common questions, and captures appointment requests in the business''s own voice.'),
(null,'ai_website_chatbot','AI website chatbot','Answers from approved business information, qualifies visitors, and hands off to a person when needed.'),
(null,'ai_sales_agent','AI sales agent','Follows up with new leads, qualifies them, and moves them toward a booking.'),
(null,'missed_call_text_back','Missed-call text-back','Texts back every missed call so the lead keeps talking instead of calling the next company.'),
(null,'crm_implementation','CRM implementation','A pipeline set up around how the client actually sells, with stages, tasks and ownership.'),
(null,'workflow_automation','Workflow automation','Triggers and actions that remove repeat work between forms, calendars, CRMs and inboxes.'),
(null,'custom_website','Custom website','A fast, mobile-ready site built to turn visitors into calls and bookings.'),
(null,'landing_page_and_funnel','Landing page and funnel','Focused pages for an offer or ad campaign, wired to capture and route every lead.'),
(null,'lead_nurturing','Lead nurturing','Timed email and SMS sequences, sent only where consent exists, that keep leads warm.'),
(null,'appointment_booking','Appointment booking','Online scheduling connected to the calendar the team already uses.'),
(null,'business_dashboards','Business dashboards','One screen of the numbers the owner actually checks, drawn from their own tools.'),
(null,'custom_saas_development','Custom SaaS development','Purpose-built software for clients whose needs don''t fit an off-the-shelf tool.'),
(null,'ai_business_agents','AI business agents','Agents that run multi-step work across a client''s tools, inside clear guardrails.'),
(null,'advertising_integrations','Advertising integrations','Connect ad platforms to the CRM so spend can be tied to booked work.'),
(null,'reputation_and_review_systems','Reputation and review systems','Automated review requests after finished jobs, with unhappy customers flagged first.')
on conflict do nothing;
