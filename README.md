# SFB Connect

AI Presence Optimization for local and service businesses. $200/year, no monthly subscription.

## Stack

- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database / Auth:** Supabase (Postgres + Row Level Security + Supabase Auth)
- **Payments:** Manual proof-of-payment — Cash App, PayPal, or Zelle, confirmed by an admin
- **Email:** Resend (wired for future transactional email; not yet called anywhere)

## How payments actually work (read this first)

Cash App and Zelle have **no merchant API or webhook** for one-off payments
like this — there is no programmatic way to know money arrived. PayPal does
have a real merchant API, but to keep all three payment methods consistent,
this app treats all three the same way:

1. Customer creates an account and picks a method on `/pay`.
2. The app generates a unique reference code (e.g. `SFB-7K2Q9X`) and shows
   payment instructions (your Cash App tag / PayPal.me / Zelle contact from
   env vars).
3. Customer sends the money through their own Cash App / PayPal / Zelle app,
   including the reference code in the note, then clicks "I've Sent
   Payment" to log it (optionally with a note or screenshot link).
4. It appears in **`/admin/payments`** as pending. You check the actual
   Cash App / PayPal / Zelle account for a matching payment + reference
   code, then click **Confirm** (or **Reject** with a reason).
5. Once confirmed, `/onboarding` unlocks for that customer — the intake
   wizard is gated on `payments.status = 'confirmed'` for their account.

There is deliberately no way to "guess" this into automation — false
confirmation would mean giving away the service for free.

## What's implemented

- **Homepage** (`app/page.tsx`) — full marketing site matching the approved
  preview: hero, search-vs-AI comparison, top-5 shortlist simulator, signal
  diagram, myth-busting cards, animated AI Presence Score, 14-day process,
  audit scope grid, platform band (with required non-affiliation
  disclaimer), $200/year pricing card, FAQ, final CTA, footer disclaimer.
  The pricing CTA links to `/pay`.
- **Payment flow** (`app/pay/page.tsx` + `app/api/payments/**`) — account
  creation, method selection, reference code generation, and proof
  submission. See above.
- **Onboarding** (`app/onboarding/page.tsx` + `app/api/onboarding/route.ts`)
  — 5-step intake (Business → Location → Services → Presence →
  Competition). Server-side gate redirects to `/pay` unless the signed-in
  user has a `confirmed` payment; the API route re-checks this before
  creating anything.
- **Customer dashboard** (`app/dashboard/**`) — Overview (status tracker,
  score, renewal date), AI Presence Score, Findings, Recommendations,
  Presence Report, Billing, Support. All server-rendered from Supabase with
  RLS enforcing that customers only see their own data.
- **Admin panel** (`app/admin/**`) — customer list, per-project detail page
  with controls to change project status, record scores, add findings, add
  recommendations, publish the final report, and leave internal notes;
  plus **`/admin/payments`** to confirm or reject pending submissions.
  Gated by `public.users.role = 'admin'` in middleware and again in every
  `/api/admin/**` route handler.
- **Database schema** (`supabase/schema.sql`) — every table from the spec's
  `database_models` list (with `payments` reshaped for the manual-review
  flow — see schema comments), with RLS policies scoping customer access
  to their own data and admin access to everything.

## Setup

1. **Supabase**
   - Create a project at supabase.com.
   - Run `supabase/schema.sql` in the SQL editor.
   - To make a user an admin: `update public.users set role = 'admin' where email = 'you@sfbconnect.com';`
     (the row is created automatically the first time that user signs up — insert it manually first if you need admin access before that).

2. **Payment contacts**
   - Decide your real Cash App tag, PayPal.me link (or email), and Zelle
     contact (email or phone). These are just display strings — no API
     keys involved.

3. **Environment variables**
   - Copy `.env.example` to `.env.local` and fill in every value.

4. **Install & run**
   ```bash
   npm install
   npm run dev
   ```

5. **Deploy to Cloudflare Pages/Workers**

   This project is set up for [OpenNext's Cloudflare adapter](https://opennext.js.org/cloudflare)
   (`@opennextjs/cloudflare` + `wrangler`), which runs full Next.js SSR —
   including the Node-dependent bits (Supabase service-role calls,
   cookie-based middleware) — on Cloudflare's Workers runtime via the
   `nodejs_compat` flag already set in `wrangler.jsonc`.

   ```bash
   npm install

   # Log in to Cloudflare once (opens a browser to authorize wrangler)
   npx wrangler login

   # Secrets — do NOT put these in wrangler.jsonc, since that file can end
   # up committed to git:
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   npx wrangler secret put RESEND_API_KEY
   # NEXT_PUBLIC_* values (including the payment contact strings) are
   # already set as plain "vars" in wrangler.jsonc — edit them there, or
   # override per-environment in the Cloudflare dashboard under Settings >
   # Variables.

   # Build with OpenNext, then deploy
   npm run cf:deploy
   ```

   - First deploy creates a `sfb-connect.<your-subdomain>.workers.dev` URL.
   - In the Cloudflare dashboard, open the Worker/Pages project →
     **Settings → Domains & Routes → Add Custom Domain** → enter
     `sfbconnect.com`. Since the domain's DNS already lives on Cloudflare,
     this provisions the CNAME/proxy record for you automatically — no
     manual DNS edits needed.
   - Update `NEXT_PUBLIC_APP_URL` to `https://sfbconnect.com` once the
     custom domain is live.
   - To iterate locally against the Workers runtime before deploying:
     `npm run cf:preview`.

   **Alternative:** this is also a completely standard Next.js app, so it
   deploys to Vercel with zero changes if you'd rather not use the Workers
   runtime — just don't run the `cf:*` scripts or add the OpenNext/wrangler
   files in that case.

## Known gaps / next steps

- Resend is installed but not wired to any transactional email yet — the
  highest-value addition here would be notifying the customer by email the
  moment their payment is confirmed (right now they'd need to reload
  `/pay` to see it), and notifying you when a new payment needs review.
- Proof "screenshots" are a plain URL field, not a real upload — wire
  Supabase Storage into `/pay`'s proof form for actual file uploads.
- Report files are referenced by URL only — wire Supabase Storage upload
  into the admin "Publish Report" form for real file hosting.
- No automated tests yet.
- The audit/optimization work itself (the actual 14-day analysis) is a
  human/ops workflow the admin panel supports — it is not automated.
