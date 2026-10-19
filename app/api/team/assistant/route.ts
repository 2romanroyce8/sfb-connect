import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AGENT_SESSION_COOKIE } from "@/lib/agent/readOnly";
import { route } from "@/lib/assistant/router";
import { runTeam, executeTeam, briefing, TEAM_HELP, type TeamUser } from "@/lib/assistant/team";
import { signAction, verifyAction } from "@/lib/assistant/confirm";
import { askLlm } from "@/lib/assistant/llm";
import type { PendingAction } from "@/lib/assistant/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Team dashboard assistant (Layer 1). Team members only. Session client throughout → crm_* RLS applies.
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: p } = await db.from("users").select("full_name, email, team_role").eq("id", user.id).single();
  if (!p?.team_role) return NextResponse.json({ error: "Team access required." }, { status: 403 });
  const me: TeamUser = { id: user.id, role: p.team_role, name: p.full_name || p.email };
  const scope = { role: "team" as const, userId: user.id };
  const body = (await req.json().catch(() => ({}))) as { message?: string; briefing?: boolean; confirm?: { action: PendingAction; token: string } };
  try {
    if (body.briefing) return NextResponse.json(await briefing(db, me));
    if (body.confirm) {
      if (cookies().get(AGENT_SESSION_COOKIE)) return NextResponse.json({ text: "This is a read-only delegated session — writes are refused." });
      if (!verifyAction(body.confirm.token, body.confirm.action, scope)) return NextResponse.json({ text: "That confirmation expired or doesn't match. Ask again and I'll re-check." });
      return NextResponse.json(await executeTeam(db, me, body.confirm.action));
    }
    const message = String(body.message ?? "").slice(0, 1000);
    const r = route(message, "team");
    if (r) return NextResponse.json({ ...(await runTeam(db, me, r, message, (a) => signAction(a, scope))), source: "router", intent: r.intent });
    const llm = await askLlm({ role: "team", message });
    if (llm) return NextResponse.json({ ...llm, source: "llm" });
    return NextResponse.json({ ...TEAM_HELP, text: "I didn't catch that one. Try one of these:", source: "fallback" });
  } catch (e) { return NextResponse.json({ text: `Something went wrong: ${e instanceof Error ? e.message : "error"}` }, { status: 500 }); }
}
