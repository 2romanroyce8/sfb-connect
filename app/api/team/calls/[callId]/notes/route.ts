import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

// Autosaves the single running notes doc for a call. Upserts on the unique
// call_id so a refresh mid-call never loses what was typed — content lives
// in Postgres, not component state.
export async function PUT(req: NextRequest, { params }: { params: { callId: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: call } = await supabase.from("crm_calls").select("id, lead_id").eq("id", params.callId).single();
  if (!call) return NextResponse.json({ error: "Call not found or not accessible." }, { status: 404 });

  const { content } = await req.json();

  const service = createSupabaseServiceClient();
  const { error } = await service.from("crm_call_notes").upsert(
    {
      call_id: call.id,
      lead_id: call.lead_id,
      rep_id: user.id,
      content: content || "",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "call_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest, { params }: { params: { callId: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: note } = await supabase.from("crm_call_notes").select("content").eq("call_id", params.callId).maybeSingle();
  return NextResponse.json({ content: note?.content || "" });
}
