import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

const demoRequestSchema = z.object({
  fullName: z.string().min(1),
  companyName: z.string().min(1),
  businessLink: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  consent: z.literal(true),
});

// Public "Book a Demo" lead-capture endpoint. Like /api/services/inquiry,
// this uses the anon-key session client so the demo_requests_public_insert
// RLS policy is what actually authorizes the write.
//
// A submitted demo request must actually show up where a rep/owner can act
// on it: this immediately creates a real crm_leads row in the
// "demo_requested" ("Book Demo (Pending)") pipeline stage using the
// prospect's own self-reported details -- it does NOT wait on research to
// finish, since the person already identified themselves and their business
// directly via the form. Research still runs separately (below) and is a
// distinct artifact a rep can review in the Research Queue; it is not a
// prerequisite for this lead existing.
//
// After capturing the request, it also kicks off the SAME real
// business-lookup research used elsewhere on the site, seeded from the link
// the prospect gave us. If that link can't be resolved into real research,
// the demo request is still saved -- we just never fabricate a
// research_prospect_id or a "report ready" status for research that didn't
// actually complete. No email/SMS confirmation is sent here: no email or
// SMS provider is wired up in this codebase yet, so claiming one was sent
// would be a lie.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please fill in every field and accept the consent checkbox." },
      { status: 400 }
    );
  }
  const { fullName, companyName, businessLink, email, phone } = parsed.data;

  // Generate the id ourselves and skip .select() on the insert: the public
  // insert policy lets anyone create a demo request, but (deliberately)
  // cannot read one back -- only the team owner can. Requesting the row
  // back via .select() would need it to satisfy the SELECT policy too,
  // which a public visitor never can, so we sidestep that entirely.
  const requestId = crypto.randomUUID();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("demo_requests").insert({
    id: requestId,
    full_name: fullName,
    company_name: companyName,
    business_link: businessLink,
    email,
    phone,
    consent_to_contact: true,
    status: "NEW",
    source: "pricing_page",
  });

  if (error) {
    console.error("Demo request insert failed", error);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
  }

  // Place it in the pipeline. A public visitor has no INSERT rights on
  // crm_leads (rightly -- crm_leads_team_insert requires a session), so
  // this is trusted server-side bookkeeping via the service client, same
  // as the research-status update below. A normalized-URL businessLink
  // goes in `website`; anything that doesn't parse as a URL is kept only
  // in source_urls/description rather than guessed into a website field.
  try {
    const service = createSupabaseServiceClient();
    let website: string | null = null;
    try {
      const withScheme = /^https?:\/\//i.test(businessLink) ? businessLink : `https://${businessLink}`;
      website = new URL(withScheme).toString();
    } catch {
      website = null;
    }
    const { data: lead, error: leadError } = await service
      .from("crm_leads")
      .insert({
        business_name: companyName,
        owner_name: fullName,
        phone,
        email,
        website,
        source_urls: [businessLink],
        pipeline_stage: "demo_requested",
        description: "Requested a demo via the pricing page.",
      })
      .select("id")
      .single();
    if (leadError) {
      console.error("Demo request -> pipeline lead creation failed", leadError);
    } else if (lead) {
      await service.from("demo_requests").update({ converted_lead_id: lead.id }).eq("id", requestId);
      await service.from("crm_activities").insert({
        lead_id: lead.id,
        activity_type: "demo_requested",
        description: `${fullName} requested a demo via the pricing page.`,
      });
    }
  } catch (err) {
    console.error("Demo request -> pipeline lead creation threw", err);
    // The demo request itself is already saved above -- a failure here
    // must never be reported back to the visitor as a failed submission.
  }

  // Best-effort: try to kick off real preliminary research from the link
  // they gave us. A research failure here must never block the demo
  // request itself, and must never upgrade the status past what actually
  // happened.
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const res = await fetch(`${url}/functions/v1/business-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
        body: JSON.stringify({ query: businessLink }),
      });
      const data = await res.json().catch(() => null);
      if (data?.status === "completed" && data?.jobId) {
        // Real research genuinely finished -- the report actually exists,
        // so REPORT_READY is true, not aspirational. This status update is
        // trusted server-side bookkeeping on the row we just created
        // ourselves (not visitor-supplied data), so it uses the service
        // client -- the public write surface stays limited to the INSERT
        // above, gated by demo_requests_public_insert.
        const service = createSupabaseServiceClient();
        await service
          .from("demo_requests")
          .update({ research_prospect_id: data.jobId, status: "REPORT_READY" })
          .eq("id", requestId);
      }
      // needs_link / failed: leave status at NEW. A demo request was still
      // captured; we just couldn't auto-start research from what they gave us.
    }
  } catch (err) {
    console.error("Preliminary research kickoff failed", err);
  }

  return NextResponse.json({ ok: true });
}
