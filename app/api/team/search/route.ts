import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Real global search — no mock results. RLS on crm_leads already restricts
// a rep to their own assigned leads, so this returns only what the caller
// can actually see.
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, business_name, phone, website, pipeline_stage")
    .or(`business_name.ilike.%${q}%,phone.ilike.%${q}%,website.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(8);

  return NextResponse.json({ results: leads ?? [] });
}
