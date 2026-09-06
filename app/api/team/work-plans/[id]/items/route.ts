import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Only the owner can add work plan items." }, { status: 403 });

  const { title, description, startDate, endDate, rowIndex, visualVariant, assignedTo, relatedLeadId } = await req.json();
  if (!title || !startDate || !endDate) return NextResponse.json({ error: "Title, start date, and end date are required." }, { status: 400 });

  const { data: item, error } = await supabase
    .from("crm_work_plan_items")
    .insert({
      work_plan_id: params.id,
      title,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      row_index: rowIndex ?? 0,
      visual_variant: visualVariant || "dark",
      assigned_to: assignedTo || null,
      related_lead_id: relatedLeadId || null,
    })
    .select("*")
    .single();
  if (error || !item) return NextResponse.json({ error: error?.message || "Could not add item." }, { status: 400 });

  return NextResponse.json(item);
}
