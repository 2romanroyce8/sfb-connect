import { NextResponse, type NextRequest } from "next/server";
import { requireOwner } from "@/lib/team/requireOwner";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { runFeed } from "@/lib/research/feed/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Feed status for the team (RLS: team members read). */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [targets, sources, runs, findings, settings] = await Promise.all([
    supabase.from("research_feed_targets").select("id, vertical, city, state, active, last_run_at").order("state").order("city"),
    supabase.from("research_feed_sources").select("id, kind, url, label, active"),
    supabase.from("research_feed_runs").select("id, trigger, status, started_at, finished_at, pulled, accepted, dropped, tasks_created, errors, targets_run, targets_skipped").order("started_at", { ascending: false }).limit(10),
    supabase.from("research_feed_findings").select("id, business_name, website, phone_e164, city, state, identity_label, accepted, quality_flags, task_id, source_kind, created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("research_feed_settings").select("enabled, schedule, token_rotated_at").eq("id", 1).maybeSingle(),
  ]);
  return NextResponse.json({ targets: targets.data ?? [], sources: sources.data ?? [], runs: runs.data ?? [], findings: findings.data ?? [], settings: settings.data ?? null, exaConfigured: !!process.env.EXA_API_KEY });
}

/** Owner-only: run the feed now (same code path as the nightly cron). */
export async function POST(req: NextRequest) {
  const guard = await requireOwner();
  if ("error" in guard) return guard.error;
  const body = (await req.json().catch(() => ({}))) as { dryRun?: boolean };
  const summary = await runFeed({ service: createSupabaseServiceClient(), trigger: "manual", deadlineMs: 45_000, dryRun: !!body.dryRun });
  return NextResponse.json(summary);
}
