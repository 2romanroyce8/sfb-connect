import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { notify } from "@/lib/crm/notify";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can reassign leads." }, { status: 403 });

  const { repId } = await req.json();
  const { data: lead, error } = await supabase
    .from("crm_leads")
    .update({ assigned_rep: repId || null, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("business_name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_activities").insert({ lead_id: params.id, rep_id: user.id, activity_type: "lead_reassigned", description: "Lead reassigned" });

  if (repId && repId !== user.id) {
    const service = createSupabaseServiceClient();
    await notify(service, {
      userId: repId,
      type: "lead_assigned",
      title: `${lead?.business_name || "A lead"} has been assigned to you.`,
      relatedLeadId: params.id,
      actionUrl: `/team/leads/${params.id}`,
      actionLabel: "Open Lead",
    });
  }

  return NextResponse.json({ ok: true });
}
