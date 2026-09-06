import { createSupabaseServerClient } from "@/lib/supabase/server";
import OwnerDashboard from "@/components/team/OwnerDashboard";
import RepDashboard from "@/components/team/RepDashboard";

export default async function TeamDashboardPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, email, team_role")
    .eq("id", user!.id)
    .single();

  const name = (profile?.full_name || profile?.email || "there").split(" ")[0];
  const isOwner = profile?.team_role === "owner";

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  if (isOwner) {
    // Company-wide numbers — real queries against currently-empty tables.
    // No fake data: every count below reflects what's actually in the DB.
    const [
      { count: totalLeads },
      { count: qualifiedLeads },
      { count: meetingsBooked },
      { count: won },
      { data: reps },
      { data: callsToday },
      { data: allCalls },
      { data: calls90 },
      { data: meetings90 },
      { data: recentLeads },
    ] = await Promise.all([
      supabase.from("crm_leads").select("id", { count: "exact", head: true }),
      supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("pipeline_stage", "interested"),
      supabase.from("crm_meetings").select("id", { count: "exact", head: true }).eq("status", "booked"),
      supabase.from("crm_leads").select("id", { count: "exact", head: true }).eq("pipeline_stage", "won"),
      supabase.from("users").select("id, full_name, email").eq("team_role", "sales_rep"),
      supabase.from("crm_calls").select("id, rep_id, duration_seconds, outcome").gte("started_at", todayStart.toISOString()),
      supabase.from("crm_calls").select("lead_id, duration_seconds, outcome"),
      supabase.from("crm_calls").select("started_at").gte("started_at", ninetyDaysAgo.toISOString()),
      supabase.from("crm_meetings").select("created_at").gte("created_at", ninetyDaysAgo.toISOString()),
      supabase
        .from("crm_leads")
        .select("id, business_name, pipeline_stage, updated_at, assigned_rep")
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    const talkTimeToday = (callsToday ?? []).reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
    const completedToday = (callsToday ?? []).filter((c) => c.duration_seconds != null);
    const avgDurationToday = completedToday.length > 0 ? Math.round(talkTimeToday / completedToday.length) : 0;
    const outcomesToday: Record<string, number> = {};
    for (const c of callsToday ?? []) {
      if (c.outcome) outcomesToday[c.outcome] = (outcomesToday[c.outcome] || 0) + 1;
    }
    const distinctLeadsCalled = new Set((allCalls ?? []).map((c) => c.lead_id)).size;
    const leadToCallConversion = totalLeads ? Math.round((distinctLeadsCalled / totalLeads) * 100) : 0;
    const totalCallsAllTime = (allCalls ?? []).length;
    const conversionRate = totalCallsAllTime ? Math.round(((meetingsBooked ?? 0) / totalCallsAllTime) * 100) : 0;

    const repActivity = (reps ?? []).map((rep) => {
      const repCallsToday = (callsToday ?? []).filter((c) => c.rep_id === rep.id);
      return {
        id: rep.id,
        name: rep.full_name || rep.email,
        callsToday: repCallsToday.length,
        talkTimeToday: repCallsToday.reduce((s, c) => s + (c.duration_seconds || 0), 0),
      };
    });

    const repNameById = Object.fromEntries((reps ?? []).map((r) => [r.id, r.full_name || r.email]));
    const recentLeadsWithRep = (recentLeads ?? []).map((l) => ({ ...l, assigned_rep_name: l.assigned_rep ? repNameById[l.assigned_rep] || null : null }));

    return (
      <OwnerDashboard
        name={name}
        totalLeads={totalLeads ?? 0}
        qualifiedLeads={qualifiedLeads ?? 0}
        meetingsBooked={meetingsBooked ?? 0}
        won={won ?? 0}
        reps={reps ?? []}
        callStats={{
          callsToday: (callsToday ?? []).length,
          talkTimeToday,
          avgDurationToday,
          outcomesToday,
          leadToCallConversion,
          conversionRate,
        }}
        repActivity={repActivity}
        chartData={{
          calls: (calls90 ?? []).map((c) => ({ at: c.started_at })),
          meetings: (meetings90 ?? []).map((m) => ({ at: m.created_at })),
        }}
        recentLeads={recentLeadsWithRep as any}
      />
    );
  }

  const [{ data: myLeads }, { data: followups }, { data: meetings }, { data: myCallsToday }, { data: calls90 }, { data: meetings90 }] = await Promise.all([
    supabase
      .from("crm_leads")
      .select("id, business_name, website, pipeline_stage, ai_overall_score, recommended_offer, updated_at")
      .eq("assigned_rep", user!.id)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("crm_followups")
      .select("id, lead_id, due_at, reason")
      .eq("rep_id", user!.id)
      .eq("status", "open")
      .order("due_at", { ascending: true })
      .limit(10),
    supabase
      .from("crm_meetings")
      .select("id, lead_id, scheduled_at, contact_name")
      .eq("rep_id", user!.id)
      .eq("status", "booked")
      .order("scheduled_at", { ascending: true })
      .limit(10),
    // RLS already scopes crm_calls to rep_id = auth.uid() for a non-owner,
    // but the explicit filter keeps this query self-documenting.
    supabase.from("crm_calls").select("id, duration_seconds, outcome").eq("rep_id", user!.id).gte("started_at", todayStart.toISOString()),
    supabase.from("crm_calls").select("started_at").eq("rep_id", user!.id).gte("started_at", ninetyDaysAgo.toISOString()),
    supabase.from("crm_meetings").select("created_at").eq("rep_id", user!.id).gte("created_at", ninetyDaysAgo.toISOString()),
  ]);

  const talkTimeToday = (myCallsToday ?? []).reduce((sum, c) => sum + (c.duration_seconds || 0), 0);
  const completedToday = (myCallsToday ?? []).filter((c) => c.duration_seconds != null);
  const avgDurationToday = completedToday.length > 0 ? Math.round(talkTimeToday / completedToday.length) : 0;

  return (
    <RepDashboard
      name={name}
      leads={myLeads ?? []}
      followups={followups ?? []}
      meetings={meetings ?? []}
      callStats={{ callsToday: (myCallsToday ?? []).length, talkTimeToday, avgDurationToday }}
      chartData={{
        calls: (calls90 ?? []).map((c) => ({ at: c.started_at })),
        meetings: (meetings90 ?? []).map((m) => ({ at: m.created_at })),
      }}
    />
  );
}
