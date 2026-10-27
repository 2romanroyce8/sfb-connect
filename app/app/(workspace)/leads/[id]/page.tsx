import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import LeadDetail from "@/components/agency/LeadDetail";
import type { Stage } from "@/lib/agency/stages";

export default async function LeadPage({ params }: { params: { id: string } }) {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = createSupabaseServerClient();
  const { data: lead } = await db.from("agy_leads").select("id, business_name, contact_name, email, phone, website, city, source, stage, value_cents, expected_close, demo_id, created_at").eq("id", params.id).eq("agency_id", r.ctx.agencyId).maybeSingle();
  if (!lead) notFound(); // RLS: a rep asking for someone else's lead gets the same 404 as a missing one
  const [{ data: stages }, { data: acts }, { data: fus }, { data: demos }, { data: ag }] = await Promise.all([
    db.from("agy_pipeline_stages").select("key, label, position, is_won, is_lost").eq("agency_id", r.ctx.agencyId).order("position"),
    db.from("agy_lead_activities").select("id, kind, body, created_at").eq("lead_id", params.id).order("created_at", { ascending: false }).limit(100),
    db.from("agy_followups").select("id, title, due_at").eq("lead_id", params.id).is("done_at", null).order("due_at"),
    db.from("agy_demo_projects").select("id, business_name, slug").eq("agency_id", r.ctx.agencyId).eq("status", "published").order("created_at", { ascending: false }),
    db.from("agencies").select("slug").eq("id", r.ctx.agencyId).maybeSingle(),
  ]);
  const demo = (demos ?? []).find((d) => d.id === lead.demo_id);
  return <div className="px-8 py-8 max-w-[1000px]"><Link href="/app/leads" className="text-[12.5px] text-[color:var(--hx-a1a1a6)] hover:underline">← Prospects</Link><LeadDetail lead={lead as never} stages={(stages ?? []) as Stage[]} activities={(acts ?? []) as never} followups={(fus ?? []) as never} demos={(demos ?? []) as never} attachedDemoUrl={demo ? `/d/${ag?.slug}/${demo.slug}` : null} /></div>;
}
