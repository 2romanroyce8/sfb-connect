import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { route } from "@/lib/assistant/router";
import { runClient, executeClient, briefingClient, CLIENT_HELP, type ClientCtx, type ClientDeps } from "@/lib/assistant/client";
import { signAction, verifyAction } from "@/lib/assistant/confirm";
import { askLlm } from "@/lib/assistant/llm";
import type { PendingAction } from "@/lib/assistant/types";
import { loadOnboarding } from "@/lib/onboarding/state";
import { getCreditBreakdown } from "@/lib/billing/guards";
import { CREDIT_PRICES } from "@/lib/agentProgram/config";
import { SFB_PLAN_LABELS, isPlanKey } from "@/lib/team/plans";
import { approveMessage, rejectMessage, addProspect } from "@/lib/outbound/engine";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Client portal assistant (Layer 1). The business is resolved HERE from the signed-in user — never taken from the request.
export async function POST(req: NextRequest) {
  const db = createSupabaseServerClient();
  const { data: { user } } = await db.auth.getUser(); if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: biz } = await db.from("businesses").select("id, legal_name, plan_key").eq("owner_id", user.id).not("plan_key", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!biz) return NextResponse.json({ error: "No active SFB membership on this login." }, { status: 403 });
  const { data: prof } = await db.from("users").select("full_name, email").eq("id", user.id).maybeSingle();
  const ctx: ClientCtx = { businessId: biz.id as string, userId: user.id, businessName: biz.legal_name as string, planLabel: isPlanKey(biz.plan_key) ? SFB_PLAN_LABELS[biz.plan_key] : String(biz.plan_key), label: (prof?.full_name || prof?.email || "Customer") as string };
  const service = createSupabaseServiceClient();
  const deps: ClientDeps = {
    db, ctx,
    onboarding: async () => { const { state } = await loadOnboarding(service, ctx.businessId); return { current: state.current, percent: state.percent, completed: state.completed, remaining: state.remaining.map((x) => ({ no: x.no, slug: x.slug, title: x.title, short: x.short, locked: x.locked })) }; },
    credits: () => getCreditBreakdown(service, ctx.businessId),
    prices: CREDIT_PRICES.map((p) => ({ key: p.key, label: p.label, credits: p.credits })),
    connections: async () => ((await service.from("integration_connections").select("provider, status, account_label").eq("owner_id", ctx.userId).in("provider", ["gmail", "google_calendar"])).data ?? []) as { provider: string; status: string; account_label: string | null }[],
  };
  const scope = { role: "client" as const, userId: user.id, businessId: ctx.businessId };
  const body = (await req.json().catch(() => ({}))) as { message?: string; briefing?: boolean; confirm?: { action: PendingAction; token: string } };
  try {
    if (body.briefing) return NextResponse.json(await briefingClient(deps));
    if (body.confirm) {
      if (!verifyAction(body.confirm.token, body.confirm.action, scope)) return NextResponse.json({ text: "That confirmation expired or doesn't match. Ask again and I'll re-check." });
      return NextResponse.json(await executeClient(service, ctx, body.confirm.action, { approveMessage: (s, id, w, o) => approveMessage(s, id, w, o), rejectMessage, addProspect: (s, i, a) => addProspect(s, i, a) }));
    }
    const message = String(body.message ?? "").slice(0, 1000);
    const r = route(message, "client");
    if (r) return NextResponse.json({ ...(await runClient(deps, r, message, (a) => signAction(a, scope))), source: "router", intent: r.intent });
    const llm = await askLlm({ role: "client", message });
    if (llm) return NextResponse.json({ ...llm, source: "llm" });
    return NextResponse.json({ ...CLIENT_HELP, text: "I didn't catch that one. Try one of these:", source: "fallback" });
  } catch (e) { return NextResponse.json({ text: `Something went wrong: ${e instanceof Error ? e.message : "error"}` }, { status: 500 }); }
}
