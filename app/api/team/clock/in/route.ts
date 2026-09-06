import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: existing } = await supabase.from("team_work_sessions").select("id").eq("rep_id", user.id).eq("status", "active").maybeSingle();
  if (existing) return NextResponse.json({ error: "Already clocked in." }, { status: 400 });

  const { data: session, error } = await supabase.from("team_work_sessions").insert({ rep_id: user.id }).select("*").single();
  if (error || !session) return NextResponse.json({ error: error?.message || "Could not clock in." }, { status: 400 });

  await supabase.from("crm_activities").insert({ rep_id: user.id, activity_type: "clocked_in", description: "Clocked in — Work Mode" });
  return NextResponse.json(session);
}
