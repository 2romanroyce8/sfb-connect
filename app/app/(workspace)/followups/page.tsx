import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import FollowupList from "@/components/agency/FollowupList";

export default async function FollowupsPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const { data } = await db.from("agy_followups").select("id, title, due_at, lead_id, agy_leads(business_name)").eq("agency_id", r.ctx.agencyId).is("done_at", null).order("due_at").limit(200);
  const rows = (data ?? []).map((f) => ({ id: f.id as string, title: f.title as string, due_at: f.due_at as string, lead_id: f.lead_id as string, lead: ((Array.isArray(f.agy_leads) ? f.agy_leads[0] : f.agy_leads) as { business_name: string } | null)?.business_name ?? "Lead" }));
  return <div className="px-8 py-8 max-w-[900px]"><h1 className="text-[24px] font-semibold tracking-tight">Follow-ups</h1><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">Open follow-ups, soonest first. Add them from a lead (<Link href="/app/leads" className="underline">Prospects</Link>).</p><FollowupList rows={rows} /></div>;
}
