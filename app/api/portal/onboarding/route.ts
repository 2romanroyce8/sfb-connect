import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cleanAnswers, missingRequired } from "@/lib/agency/onboarding";
export const dynamic = "force-dynamic";

// A client user saves or submits THEIR onboarding. The client id is never taken from the request: it's looked up from the signed-in user's membership,
// and the write goes through the SESSION client, so RLS (own client only; draft/changes_requested only; can't self-approve) is the authority.
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient(); const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: m } = await db.from("agy_client_members").select("client_id, agency_id").eq("user_id", user.id).order("created_at").limit(1).maybeSingle(); if (!m) return NextResponse.json({ error: "You aren't linked to a client yet." }, { status: 403 });
  const b = (await req.json().catch(() => ({}))) as { answers?: unknown; submit?: unknown }; const answers = cleanAnswers(b.answers); const submit = b.submit === true;
  if (submit) { const miss = missingRequired(answers); if (miss.length) return NextResponse.json({ error: `Still needed: ${miss.join(", ")}.` }, { status: 400 }); }
  const { data: cur } = await db.from("agy_onboarding").select("status").eq("client_id", m.client_id).maybeSingle();
  if (cur && !["draft", "changes_requested"].includes(cur.status as string)) return NextResponse.json({ error: cur.status === "approved" ? "This onboarding is already approved." : "This onboarding is waiting for review and can't be edited." }, { status: 409 });
  const row = { client_id: m.client_id, agency_id: m.agency_id, answers, status: submit ? "submitted" : "draft", submitted_at: submit ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
  const { error } = cur ? await db.from("agy_onboarding").update(row).eq("client_id", m.client_id) : await db.from("agy_onboarding").insert(row);
  if (error) return NextResponse.json({ error: error.code === "42501" ? "You can't change that." : "Couldn't save. Try again." }, { status: error.code === "42501" ? 403 : 500 });
  return NextResponse.json({ ok: true, status: row.status });
}
