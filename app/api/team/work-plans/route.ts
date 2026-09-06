import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can create work plans." }, { status: 403 });

  const { name, description, planType, startDate, endDate, relatedLeadId } = await req.json();
  if (!name || !startDate || !endDate) return NextResponse.json({ error: "Name, start date, and end date are required." }, { status: 400 });

  const { data: plan, error } = await supabase
    .from("crm_work_plans")
    .insert({
      name,
      description: description || null,
      plan_type: planType || "internal_roadmap",
      start_date: startDate,
      end_date: endDate,
      related_lead_id: relatedLeadId || null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !plan) return NextResponse.json({ error: error?.message || "Could not create plan." }, { status: 400 });

  return NextResponse.json(plan);
}
