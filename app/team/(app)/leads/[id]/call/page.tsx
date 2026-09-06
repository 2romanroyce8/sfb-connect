import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CallWorkspace from "@/components/team/CallWorkspace";

export default async function LeadCallPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Work Mode gate: calling is a company-sensitive action, so it requires an
  // active clock-in. Owners aren't exempt-by-role here on purpose -- the
  // gate is about the session, not the title.
  const { data: workSession } = await supabase.from("team_work_sessions").select("id").eq("rep_id", user!.id).eq("status", "active").maybeSingle();
  if (!workSession) {
    return (
      <div className="px-8 py-16 flex flex-col items-center text-center">
        <CalendarClock size={28} className="text-[#6E6E73] mb-4" />
        <div className="text-[17px] font-medium text-[#F5F5F7] mb-1.5">Clock in to unlock calling</div>
        <p className="text-[13px] text-[#A1A1A6] mb-5 max-w-[360px]">
          The call workspace is part of Work Mode. Clock in from the sidebar, then come back here.
        </p>
        <Link href="/team/clock" className="h-[38px] px-4 inline-flex items-center rounded-[8px] bg-white text-black text-[13px] font-semibold">
          Go to Clock
        </Link>
      </div>
    );
  }

  const { data: lead } = await supabase
    .from("crm_leads")
    .select("id, business_name, website, phone, category, city, state")
    .eq("id", params.id)
    .single();
  if (!lead) notFound();

  const { data: audit } = await supabase
    .from("crm_audits")
    .select("id, overall_score")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: categories } = audit
    ? await supabase
        .from("crm_audit_categories")
        .select("category, score, negative_evidence, positive_evidence")
        .eq("audit_id", audit.id)
    : { data: [] as any[] };

  const { data: opportunity } = await supabase
    .from("crm_opportunities")
    .select("primary_offer, confidence")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: script } = await supabase
    .from("crm_scripts")
    .select("*")
    .eq("lead_id", params.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // An active session is one this rep started and never ended — reload
  // should resume it, not silently drop the in-progress call.
  const { data: activeCall } = await supabase
    .from("crm_calls")
    .select("id, started_at")
    .eq("lead_id", params.id)
    .eq("rep_id", user!.id)
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let existingNotes = "";
  if (activeCall) {
    const { data: note } = await supabase.from("crm_call_notes").select("content").eq("call_id", activeCall.id).maybeSingle();
    existingNotes = note?.content || "";
  }

  return (
    <CallWorkspace
      lead={lead as any}
      categories={(categories as any) || []}
      opportunity={(opportunity as any) || null}
      script={(script as any) || null}
      activeCall={activeCall as any}
      existingNotes={existingNotes}
    />
  );
}
