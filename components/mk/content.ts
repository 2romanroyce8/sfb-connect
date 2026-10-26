// All public-site copy lives here. Rules: no invented statistics, customers or testimonials; no guaranteed-result claims; simulations are labeled.
export const INDUSTRIES = ["HVAC", "Plumbing", "Roofing", "Electricians", "Landscaping", "Junk removal", "Cleaning", "Auto detailing", "Dental offices", "Med spas", "Real estate", "Legal services", "Home remodeling", "Restaurants", "Fitness studios", "Salons", "General contractors"];

export const SERVICES: { title: string; body: string; tag?: string }[] = [
  { title: "AI voice receptionist", body: "Answers calls, handles common questions, and captures appointment requests in the business's own voice." },
  { title: "AI website chatbot", body: "Answers from approved business information, qualifies visitors, and hands off to a person when needed." },
  { title: "AI sales agent", body: "Follows up with new leads, qualifies them, and moves them toward a booking." },
  { title: "Missed-call text-back", body: "Texts back every missed call so the lead keeps talking instead of calling the next company." },
  { title: "CRM implementation", body: "A pipeline set up around how the client actually sells, with stages, tasks and ownership." },
  { title: "Workflow automation", body: "Triggers and actions that remove repeat work between forms, calendars, CRMs and inboxes." },
  { title: "Custom website", body: "A fast, mobile-ready site built to turn visitors into calls and bookings." },
  { title: "Landing page and funnel", body: "Focused pages for an offer or ad campaign, wired to capture and route every lead." },
  { title: "Lead nurturing", body: "Timed email and SMS sequences, sent only where consent exists, that keep leads warm." },
  { title: "Appointment booking", body: "Online scheduling connected to the calendar the team already uses." },
  { title: "Business dashboards", body: "One screen of the numbers the owner actually checks, drawn from their own tools." },
  { title: "Custom SaaS development", body: "Purpose-built software for clients whose needs don't fit an off-the-shelf tool." },
  { title: "AI business agents", body: "Agents that run multi-step work across a client's tools, inside clear guardrails." },
  { title: "Advertising integrations", body: "Connect ad platforms to the CRM so spend can be tied to booked work." },
  { title: "Reputation and review systems", body: "Automated review requests after finished jobs, with unhappy customers flagged first." },
];

export const AUDIENCES = [
  { title: "Agency owners", body: "Launch an AI agency under your own name, price your own services, and run sales, delivery and billing from one workspace.", href: "/agency-owners" },
  { title: "Sales representatives", body: "Work a pipeline, send personalized demos, and book meetings, with every lead and activity in one place.", href: "/sales-reps" },
];

export const HOME_STEPS = [
  { title: "Build", body: "Create a demo for a specific business: its name, services, hours and industry." },
  { title: "Brand", body: "Apply your logo, colors and booking link so it looks like your agency's product." },
  { title: "Publish", body: "Share a link. See when it is opened and what the prospect does." },
  { title: "Sell", body: "Follow up with the prospect who opened your link and turn the conversation into a client." },
];

export const WORKSPACE = [
  { tag: "Coming next", title: "Prospects and CRM", body: "Pipeline, contacts, tasks, notes and follow-ups, with every activity recorded." },
  { tag: "Available now", title: "Demo builder", body: "Personalized demos with a published link and engagement tracking." },
  { tag: "Coming next", title: "Clients and portal", body: "Each client sees only their own onboarding, services, files and progress." },
  { tag: "Coming next", title: "Fulfillment", body: "Orders move through real states from quote to live, with a task list for every build." },
  { tag: "Coming next", title: "Revenue and usage", body: "Your cost, your retail price and your margin, kept separate and visible." },
  { tag: "Coming next", title: "Team and permissions", body: "Invite staff with roles. Permissions are enforced on the server, not just hidden in the UI." },
];

export const PORTAL = [
  { tag: "Coming next", title: "Structured onboarding", body: "Intake for business details, hours, services, booking preferences and approvals, with progress tracking." },
  { tag: "Coming next", title: "Project progress", body: "Clients follow milestones from quote through QA to launch." },
  { tag: "Coming next", title: "Secure by default", body: "Clients see only their own organization. Credentials go through secure integration flows, never plain-text forms." },
];

export const PRICING_FAQ = [
  { q: "What does the platform cost?", a: "The agency workspace is $49 per month. Billing is not switched on yet, so creating a workspace is free for now. The CRM, client portal and fulfillment tracking are being added to the workspace." },
  { q: "What about the cost of building for my clients?", a: "The plan is for client builds to be quoted at wholesale inside your workspace, with you setting your own retail price. Ordering is being built now and is not open yet." },
  { q: "Can I use the pricing calculator before I sign up?", a: "Yes. The calculator on the Resources page works with your own numbers and does not need an account." },
  { q: "Do voice and messaging cost extra?", a: "Usage-based items such as voice minutes and SMS are metered. Your workspace shows usage against limits so there are no surprises." },
];

export const HOME_FAQ = [
  { q: "Do I need technical skills to run an AI agency on SFB Connect?", a: "No. You sell and manage the relationship. Fulfillment tooling is the next thing we are building. A technical background helps but is not required." },
  { q: "Are the demos on the homepage live AI?", a: "No. The panels on this page are scripted simulations and are labeled as such. Inside your workspace you build demos around a real business's own details." },
  { q: "Can I use my own brand and domain?", a: "Yes. Demos and client portals use your logo and colors. A custom domain attaches only after DNS verification, so no one can claim a domain that isn't theirs." },
  { q: "Do you guarantee results for my clients?", a: "No, and you shouldn't either. The ROI tools use transparent formulas from your own inputs and are labeled as estimates." },
  { q: "Who sees my clients and leads?", a: "Only your agency. Each agency's data is isolated from every other agency and from SFB Connect's own internal sales data." },
  { q: "What happens to messages and calls?", a: "Nothing is sent during a demo. Production messaging only runs where it is configured and consent exists, with opt-outs honored." },
];

export const SOLUTION_NOTES: Record<string, string> = {};
