import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const PLATFORMS = ["chatgpt", "claude", "perplexity", "grok", "google_ai"];
const STATUSES = ["not_tested", "detected", "not_detected", "error", "inconclusive"];

/**
 * Records an AI visibility observation (or registers a query for tracking
 * with status 'not_tested' and no checked_at). business_id is always
 * resolved server-side from the project -- never client-supplied.
 * Each call INSERTS a new row (immutable history) rather than updating an
 * existing one, same pattern as presence_scores.
 * Body: { platform, queryText, status, observedPosition?, businessesReturned?,
 *         evidenceText?, sourceUrl?, competitorId?, checked }
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.message }, { status: guard.status });

  const body = await req.json().catch(() => null);
  const { platform, queryText, status, observedPosition, businessesReturned, evidenceText, sourceUrl, competitorId, checked } = body || {};

  if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  if (!queryText) return NextResponse.json({ error: "queryText is required." }, { status: 400 });
  if (!STATUSES.includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const service = createSupabaseServiceClient();

  const { data: project, error: projectErr } = await service
    .from("projects")
    .select("id, business_id")
    .eq("id", params.id)
    .maybeSingle();
  if (projectErr || !project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const { error } = await service.from("ai_visibility_observations").insert({
    business_id: project.business_id,
    project_id: project.id,
    platform,
    query_text: queryText,
    status,
    observed_position: observedPosition ?? null,
    businesses_returned: businessesReturned ?? null,
    evidence_text: evidenceText ?? null,
    source_url: sourceUrl ?? null,
    competitor_id: competitorId ?? null,
    checked_at: checked === false ? null : new Date().toISOString(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
