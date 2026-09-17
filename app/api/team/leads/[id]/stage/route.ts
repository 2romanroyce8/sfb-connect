import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { SFB_PLAN_PRICES, isPlanKey } from "@/lib/team/plans";
import { awardPointsForEvent, reversePointEvent, saleEventTypeForPlan } from "@/lib/team/competition/scoring";

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
  if (stage === "won" && !isPlanKey(planKey)) {
    return NextResponse.json({ error: "Select which plan was sold before marking this lead won." }, { status: 400 });
  }

  const { data: lead, error: readError } = await supabase.from("crm_leads").select("pipeline_stage, assigned_rep, business_name, email, phone, website").eq("id", params.id).single();
  if (readError || !lead) return NextResponse.json({ error: "Lead not found or not accessible." }, { status: 404 });
  // Same stage twice (e.g. a repeated/duplicate "won" submission) is a
  // no-op -- this is the idempotency guard: it never reaches the revenue
  // insert a second time.
  if (lead.pipeline_stage === stage) return NextResponse.json({ ok: true });
  const wasWon = lead.pipeline_stage === "won";

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
    const { data: revenueEvent, error: revenueError } = await supabase
      .from("revenue_events")
      .insert({
        lead_id: params.id,
        rep_id: user.id,
        plan_key: planKey,
        amount: SFB_PLAN_PRICES[planKey as keyof typeof SFB_PLAN_PRICES],
        event_type: "new_sale",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (revenueError) {
      // The stage change already succeeded -- don't roll that back over a
      // revenue-logging failure, but do surface it honestly rather than
      // silently losing the revenue record.
      return NextResponse.json({ ok: true, warning: "Lead marked won, but the revenue event could not be recorded: " + revenueError.message });
    }
    if (revenueEvent) {
      // Competition points for a real Won+plan transition -- plan-specific,
      // owner-configurable via competition_scoring_rules (sale_<plan_key>).
      await awardPointsForEvent({
        userId: user.id,
        eventType: saleEventTypeForPlan(planKey),
        sourceType: "revenue_events",
        sourceId: revenueEvent.id,
        description: `${planKey.replace(/_/g, " ")} sale`,
      });
    }

    // A "Won" deal is the moment a customer account actually needs to
    // exist -- this is what makes "authenticated existing customer" a real
    // concept instead of an aspiration. Best-effort: if this fails, the
    // sale/revenue event above has already succeeded and must not be
    // rolled back over it; the owner can provision manually from
    // /team/settings/add-ons if needed.
    try {
      await provisionCustomerAccount({ leadId: params.id, businessName: lead.business_name, email: lead.email, phone: lead.phone, website: lead.website, planKey });
    } catch (err) {
      console.error("Customer account provisioning failed after Won", err);
    }
  } else if (wasWon) {
    // Reopening a previously-won deal (moved off "won" to any other stage).
    // Never silently delete revenue history -- reverse the active event(s)
    // instead, so the Revenue chart stops counting them going forward while
    // the audit trail still shows exactly what happened and when.
    const { data: reversedEvents } = await supabase
      .from("revenue_events")
      .update({ reversed_at: new Date().toISOString() })
      .eq("lead_id", params.id)
      .is("reversed_at", null)
      .select("id, rep_id, plan_key");
    for (const rev of reversedEvents ?? []) {
      await reversePointEvent({
        userId: rev.rep_id,
        eventType: saleEventTypeForPlan(rev.plan_key),
        sourceType: "revenue_events",
        sourceId: rev.id,
        reason: `Revenue reversed — lead reopened from won to ${stage.replace(/_/g, " ")}`,
      });
    }
    await supabase.from("crm_activities").insert({
      lead_id: params.id,
      rep_id: user.id,
      activity_type: "revenue_reversed",
      description: `Revenue reversed — lead reopened from won to ${stage.replace(/_/g, " ")}`,
    });
  }

  return NextResponse.json({ ok: true });
}

// Runs on the service client -- a rep marking a deal "won" has no direct
// Auth-admin rights of their own, and this is trusted server-side
// bookkeeping (the same pattern as the existing team-invite flow), not
// something the acting user's own session should need elevated RLS for.
async function provisionCustomerAccount(params: { leadId: string; businessName: string | null; email: string | null; phone: string | null; website: string | null; planKey: string }) {
  if (!params.email) {
    console.warn(`Won lead ${params.leadId} has no email on file -- cannot provision a customer account yet.`);
    return;
  }
  const service = createSupabaseServiceClient();

  // Idempotent: a lead that was already provisioned (e.g. reopened then
  // re-won) must never get a second business/account.
  const { data: existingBusiness } = await service.from("businesses").select("id").eq("source_lead_id", params.leadId).maybeSingle();
  if (existingBusiness) return;

  // Reuse an existing auth account for this email if one already exists
  // (e.g. the same person already has a business under SFB) rather than
  // inviting a duplicate.
  const { data: existingUser } = await service.from("users").select("id").eq("email", params.email).maybeSingle();

  let ownerId = existingUser?.id ?? null;
  if (!ownerId) {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sfbconnect.com";
    const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(params.email, {
      redirectTo: `${siteUrl}/dashboard/login`,
    });
    if (inviteError || !invited?.user) throw new Error(inviteError?.message || "Could not invite customer.");
    ownerId = invited.user.id;
  }

  const { data: business, error: businessError } = await service
    .from("businesses")
    .insert({
      owner_id: ownerId,
      legal_name: params.businessName,
      website: params.website,
      plan_key: params.planKey,
      source_lead_id: params.leadId,
    })
    .select("id")
    .single();
  if (businessError || !business) throw new Error(businessError?.message || "Could not create business record.");

  await service.from("billing_audit_log").insert({
    business_id: business.id,
    action: "customer_provisioned",
    detail: { lead_id: params.leadId, plan_key: params.planKey, invited: !existingUser },
  });
}
