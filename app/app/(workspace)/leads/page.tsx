import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import LeadsManager from "@/components/agency/LeadsManager";
import type { Stage } from "@/lib/agency/stages";

export default async function LeadsPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const [{ data: leads }, { data: stages }] = await Promise.all([
    db.from("agy_leads").select("id, business_name, contact_name, email, phone, city, stage, value_cents, created_at").eq("agency_id", r.ctx.agencyId).eq("archived", false).order("created_at", { ascending: false }).limit(1000),
    db.from("agy_pipeline_stages").select("key, label, position, is_won, is_lost").eq("agency_id", r.ctx.agencyId).order("position"),
  ]);
  return <div className="px-8 py-8 max-w-[1200px]"><h1 className="text-[24px] font-semibold tracking-tight">Prospects</h1><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">{["sales_rep"].includes(r.ctx.role) ? "You see the leads you own." : "Every lead in your agency."}</p><LeadsManager leads={(leads ?? []) as never} stages={(stages ?? []) as Stage[]} canAdd={["owner", "admin", "sales_manager", "sales_rep"].includes(r.ctx.role)} /></div>;
}
