import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_TYPES = ["CALL", "MEETING", "EMAIL", "TASK", "RESEARCH"];

// Quick-create for a follow-up not tied to a call outcome. RLS
// (crm_followups_owner_all / crm_followups_rep_own) governs who can
// actually insert what — a rep can only end up creating one assigned to
// themselves; the assignedTo override only takes effect for the owner.
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = caller?.team_role === "owner";

  const body = await req.json().catch(() => ({}));
  const leadId: string | undefined = body.leadId;
  const dueAt: string | undefined = body.dueAt;
  const followupType: string = VALID_TYPES.includes(body.followupType) ? body.followupType : "CALL";
  if (!leadId || !dueAt) return NextResponse.json({ error: "A lead and due date are required." }, { status: 400 });

  const repId = isOwner && body.assignedTo ? body.assignedTo : user.id;

  const { data: followup, error } = await supabase
    .from("crm_followups")
    .insert({
      lead_id: leadId,
      rep_id: repId,
      created_by: user.id,
      followup_type: followupType,
      due_at: dueAt,
      timezone: body.timezone || "America/New_York",
      reason: body.reason || null,
      title: body.title || null,
    })
    .select("id")
    .single();

  if (error || !followup) return NextResponse.json({ error: error?.message || "Could not create follow-up." }, { status: 400 });

  await supabase.from("crm_activities").insert({
    lead_id: leadId,
    rep_id: user.id,
    activity_type: "follow_up_created",
    description: `Follow-up created (${followupType.toLowerCase()})`,
  });

  return NextResponse.json({ ok: true, followupId: followup.id });
}
