import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runVisibilityScan, ALL_PLATFORMS } from "@/lib/intelligence/orchestrator";
import { isEngineEnabled, providerConfigurationState, requiredEnvVarFor } from "@/lib/intelligence/providers";

/**
 * ADMIN/TEAM-ONLY manual controlled visibility scan (owner role only).
 * Never exposed to customers. Enforces the master kill switch and hard
 * server-side caps on checks and estimated spend regardless of the
 * request body. No scheduler calls this -- recurring scans remain OFF.
 *
 * GET returns configuration state only (which providers are ready / what
 * env var each needs) so an owner can see the credential boundary without
 * triggering anything.
 */
async function requireOwner() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, res: NextResponse.json({ error: "Not authenticated." }, { status: 401 }) };
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user.id).single();
  if (caller?.team_role !== "owner") return { ok: false as const, res: NextResponse.json({ error: "Owner access required." }, { status: 403 }) };
  return { ok: true as const, user, supabase };
}

export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.res;
  const providers = Object.fromEntries(ALL_PLATFORMS.map((p) => [p, { state: providerConfigurationState(p), requiredEnvVar: requiredEnvVarFor(p) }]));
  return NextResponse.json({ engineEnabled: isEngineEnabled(), masterSwitchEnvVar: "AI_VISIBILITY_ENGINE_ENABLED", providers, recurringScans: "OFF (no scheduler exists)" });
}

export async function POST(req: NextRequest) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.res;

  if (!isEngineEnabled()) {
    return NextResponse.json({ error: "AI visibility engine is disabled. Set AI_VISIBILITY_ENGINE_ENABLED=true to allow manual owner scans. Recurring scans remain off regardless.", ownerActionRequired: ["AI_VISIBILITY_ENGINE_ENABLED=true"] }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const { businessId, maxChecks, maxSpendCents, platforms, maxCompetitors, trackedQueryIds } = body as {
    businessId?: string;
    maxChecks?: number;
    maxSpendCents?: number;
    platforms?: string[];
    maxCompetitors?: number;
    trackedQueryIds?: string[];
  };
  if (!businessId) return NextResponse.json({ error: "businessId is required." }, { status: 400 });

  const { data: business } = await auth.supabase.from("businesses").select("id").eq("id", businessId).maybeSingle();
  if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

  try {
    const summary = await runVisibilityScan({
      businessId,
      triggeredByUserId: auth.user.id,
      maxChecks: typeof maxChecks === "number" ? maxChecks : undefined,
      maxSpendCents: typeof maxSpendCents === "number" ? maxSpendCents : undefined,
      platforms: platforms as any,
      maxCompetitors,
      trackedQueryIds: Array.isArray(trackedQueryIds) ? trackedQueryIds.filter((s) => typeof s === "string") : undefined,
    });
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scan failed." }, { status: 500 });
  }
}
