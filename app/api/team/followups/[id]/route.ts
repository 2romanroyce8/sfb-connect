import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// RLS on crm_followups (rep_id = auth.uid() or owner) governs this directly
// on the session client — no service-role escape hatch needed here.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (body.status) update.status = body.status;
  if (body.dueAt) update.due_at = body.dueAt;
  if (body.reason !== undefined) update.reason = body.reason;

  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data: followup, error } = await supabase.from("crm_followups").update(update).eq("id", params.id).select("lead_id").single();
  if (error || !followup) return NextResponse.json({ error: error?.message || "Follow-up not found or not accessible." }, { status: 400 });

  await supabase.from("crm_activities").insert({
    lead_id: followup.lead_id,
    rep_id: user.id,
    activity_type: "follow_up_updated",
    description: body.status ? `Follow-up marked ${body.status}` : "Follow-up rescheduled",
  });

  return NextResponse.json({ ok: true });
}
