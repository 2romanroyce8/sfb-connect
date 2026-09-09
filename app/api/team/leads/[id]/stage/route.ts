import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const VALID_STAGES = [
  "new",
  "researching",
  "ready_to_call",
  "contacted",
  "interested",
  "follow_up",
  "nurture",
  "meeting_booked",
  "proposal",
  "won",
  "lost",
];

// Single source of truth for what each plan is actually worth. Never trust
// a client-supplied dollar amount for a revenue event -- always derive it
// from the plan key server-side, so the Revenue chart can never be fed a
// fabricated or mistyped number.
const PLAN_PRICES: Record<string, number> = {
  revenue_presence: 19.99,
  revenue_growth: 197,
  revenue_dominance: 359,
};

// Runs entirely on the session-scoped client on purpose: crm_leads' own RLS
// (owner: all, rep: only assigned_rep = auth.uid()) decides whether this
// write is even allowed. A rep dragging another rep's card never reaches
// the database with permission to move it — no application-level check
// could be as reliable as just relying on the policy that's already there.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { stage, planKey } = await req.json();
  if (!VALID_STAGES.includes(stage)) return NextResponse.json({ error: "Invalid stage." }, { status: 400 });

  // Marking a lead "won" is a real revenue event, not just a status label --
  // require the rep to say which plan was actually sold so the amount is
  // never guessed. No planKey, no "won".
  if (stage === "won" && !PLAN_PRICES[planKey]) {
    return NextResponse.json({ error: "Select which plan was sold before marking this lead won." }, { status: 400 });
  }

  const { data: lead, error: readError } = await supabase.from("crm_leads").select("pipeline_stage, assigned_rep").eq("id", params.id).single();
  if (readError || !lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });
  if (lead.pipeline_stage === stage) return NextResponse.json({ ok: true });

  const { error } = await supabase
    .from("crm_leads")
    .update({ pipeline_stage: stage, updated_at: new Date().toISOString() })
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("crm_pipeline_history").insert({ lead_id: params.id, from_stage: lead.pipeline_stage, to_stage: stage, changed_by: user.id });
  await supabase.from("crm_activities").insert({
    lead_id: params.id,
    rep_id: user.id,
    activity_type: "pipeline_changed",
    description: `Moved from ${lead.pipeline_stage.replace(/_/g, " ")} to ${stage.replace(/_/g, " ")}`,
  });

  if (stage === "won") {
    // rep_id on the revenue event is whoever actually closed it (the acting
    // user), not necessarily the lead's long-term assigned_rep -- these
    // usually match, but the event should reflect who gets credit for it.
    const { error: revenueError } = await supabase.from("revenue_events").insert({
      lead_id: params.id,
      rep_id: user.id,
      plan_key: planKey,
      amount: PLAN_PRICES[planKey],
      event_type: "new_sale",
      created_by: user.id,
    });
    if (revenueError) {
      // The stage change already succeeded -- don't roll that back over a
      // revenue-logging failure, but do surface it honestly rather than
      // silently losing the revenue record.
      return NextResponse.json({ ok: true, warning: "Lead marked won, but the revenue event could not be recorded: " + revenueError.message });
    }
  }

  return NextResponse.json({ ok: true });
}
