import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toOrFilterValue } from "@/lib/postgrestFilter";

// Real global search — no mock results. RLS on crm_leads already restricts
// a rep to their own assigned leads, so this returns only what the caller
// can actually see. See lib/postgrestFilter.ts for why the search term
// must be escaped before being interpolated into the .or() filter string --
// this used to break (silently, returning a false "no results") on any
// search term containing a comma, e.g. "Roofing, LLC".
export async function GET(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ results: [] });

  const term = toOrFilterValue(`%${q}%`);
  const { data: leads, error } = await supabase
    .from("crm_leads")
    .select("id, business_name, phone, website, pipeline_stage, city, state")
    .or(`business_name.ilike.${term},phone.ilike.${term},website.ilike.${term},email.ilike.${term}`)
    .limit(8);

  // Never silently swallow a query error into an empty result -- that's
  // exactly what made this bug invisible in production. Surface it so a
  // rep sees "search failed" instead of a confusing false "no matches".
  if (error) return NextResponse.json({ error: error.message, results: [] }, { status: 500 });

  return NextResponse.json({ results: leads ?? [] });
}
