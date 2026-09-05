import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CallWorkspace from "@/components/team/CallWorkspace";

export default async function LeadCallPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
