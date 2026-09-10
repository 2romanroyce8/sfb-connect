import { createSupabaseServiceClient } from "@/lib/supabase/server";

// The ONE place that awards competition points. Every real event source
// (calls, meetings, follow-ups, sales) calls awardPointsForEvent() instead
// of inserting into staff_point_events directly or hardcoding a number --
// this is what keeps the point values owner-configurable and keeps the
// idempotency/verification rules from being duplicated (and drifting) in
// four different API routes.
export type ScoringEventInput = {
  userId: string;
  eventType: string;
  sourceType: string;
  sourceId: string;
  occurredAt?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export async function awardPointsForEvent(input: ScoringEventInput): Promise<{ awarded: boolean; points?: number; reason?: string }> {
  const service = createSupabaseServiceClient();

  const { data: rule } = await service
    .from("competition_scoring_rules")
    .select("points, active, effective_from, effective_to")
    .eq("event_type", input.eventType)
    .maybeSingle();

  if (!rule) return { awarded: false, reason: "no_scoring_rule" };
  if (!rule.active) return { awarded: false, reason: "rule_inactive" };

  const now = input.occurredAt ? new Date(input.occurredAt) : new Date();
  if (rule.effective_from && now < new Date(rule.effective_from)) return { awarded: false, reason: "not_yet_effective" };
  if (rule.effective_to && now > new Date(rule.effective_to)) return { awarded: false, reason: "rule_expired" };
  if (rule.points === 0) return { awarded: false, reason: "zero_point_rule" };

  // Idempotency is enforced by the DB unique index
  // (user_id, event_type, source_type, source_id) -- upsert with
  // ignoreDuplicates so a retried/duplicate call never awards points twice,
  // no matter how many times this function gets invoked for the same
  // source event.
  const { error, data } = await service
    .from("staff_point_events")
    .upsert(
      {
        user_id: input.userId,
        event_type: input.eventType,
        points: rule.points,
        source_type: input.sourceType,
        source_id: input.sourceId,
        description: input.description ?? null,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        metadata: input.metadata ?? null,
      },
      { onConflict: "user_id,event_type,source_type,source_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (error) return { awarded: false, reason: error.message };
  if (!data) return { awarded: false, reason: "duplicate_source_event" };
  return { awarded: true, points: Number(rule.points) };
}

// Reverses a previously-awarded event without deleting it -- the row stays
// forever with reversed=true + a reason, so aggregates (which filter
// reversed=false) stop counting it while the audit trail survives.
export async function reversePointEvent(params: { userId: string; eventType: string; sourceType: string; sourceId: string; reason: string }) {
  const service = createSupabaseServiceClient();
  const { error, data } = await service
    .from("staff_point_events")
    .update({ reversed: true, reversed_at: new Date().toISOString(), reversal_reason: params.reason })
    .eq("user_id", params.userId)
    .eq("event_type", params.eventType)
    .eq("source_type", params.sourceType)
    .eq("source_id", params.sourceId)
    .eq("reversed", false)
    .select("id")
    .maybeSingle();
  if (error) return { reversed: false, reason: error.message };
  return { reversed: !!data };
}

export function saleEventTypeForPlan(planKey: string): string {
  return `sale_${planKey}`;
}
