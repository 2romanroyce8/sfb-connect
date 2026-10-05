import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { computeAndSaveAudit } from "@/lib/crm/audit";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // RLS decides visibility here — if this rep isn't assigned to the lead and
  // isn't the owner, this comes back empty and we refuse before touching the
  // service client.
  const { data: lead } = await supabase.from("crm_leads").select("id").eq("id", params.id).single();
  if (!lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  const isOwner = caller?.team_role === "owner";
  const body = await req.json().catch(() => ({}));

  try {
    // Identity gate (Research Spec §24): reps can't audit an unconfirmed
    // business; the owner can, explicitly, with force=true.
    const result = await computeAndSaveAudit(params.id, user.id, { allowUnconfirmedIdentity: isOwner && body?.force === true });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Audit failed." }, { status: 400 });
  }
}
