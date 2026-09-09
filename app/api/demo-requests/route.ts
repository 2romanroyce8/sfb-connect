import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
// After capturing the request, it kicks off the SAME real business-lookup
// research used elsewhere on the site, seeded from the link the prospect
// gave us. If that link can't be resolved into real research, the demo
// request is still saved -- we just never fabricate a research_prospect_id
// or a "report ready" status for research that didn't actually complete.
// No email/SMS confirmation is sent here: no email or SMS provider is
// wired up in this codebase yet, so claiming one was sent would be a lie.
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

  const supabase = createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("demo_requests")
    .insert({
      full_name: fullName,
      company_name: companyName,
      business_link: businessLink,
      email,
      phone,
      consent_to_contact: true,
      status: "NEW",
      source: "pricing_page",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("Demo request insert failed", error);
    return NextResponse.json({ error: "Could not submit your request. Please try again." }, { status: 500 });
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
        // so REPORT_READY is true, not aspirational.
        await supabase
          .from("demo_requests")
          .update({ research_prospect_id: data.jobId, status: "REPORT_READY" })
          .eq("id", inserted.id);
      }
      // needs_link / failed: leave status at NEW. A demo request was still
      // captured; we just couldn't auto-start research from what they gave us.
    }
  } catch (err) {
    console.error("Preliminary research kickoff failed", err);
  }

  return NextResponse.json({ ok: true });
}
