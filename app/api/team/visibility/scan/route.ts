import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runVisibilityScan } from "@/lib/intelligence/orchestrator";
import { isEngineEnabled } from "@/lib/intelligence/providers";

/**
 * ADMIN/TEAM-ONLY manual controlled visibility scan (owner role only,
 * matching the same team_role==='owner' pattern already used for
 * /api/team/billing/catalog -- this is privileged internal tooling, not a
 * customer-facing endpoint, and must never become one without a real
 * design pass on customer-facing scan limits/UX).
 *
 * NEVER exposed to customers. Enforces the master kill switch
 * (AI_VISIBILITY_ENGINE_ENABLED) and a hard per-request check cap
 * regardless of what the caller requests -- see runVisibilityScan's
 * HARD_TEST_LIMIT.
 */
export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return NextResponse.json({ error: "Owner access required." }, { status: 403 });

  if (!isEngineEnabled()) {
    return NextResponse.json(
      { error: "AI visibility engine is disabled (AI_VISIBILITY_ENGINE_ENABLED is not set to 'true'). This is intentional until provider credentials and billing units are reviewed." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { businessId, maxChecks, platforms, maxCompetitors } = body as {
    businessId?: string;
    maxChecks?: number;
    platforms?: string[];
    maxCompetitors?: number;
  };
  if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

  const { data: business } = await supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  try {
    const summary = await runVisibilityScan({
      businessId,
      triggeredByUserId: user.id,
      maxChecks: typeof maxChecks === "number" ? maxChecks : 10,
      platforms: platforms as any,
      maxCompetitors,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scan failed." }, { status: 500 });
  }
}
