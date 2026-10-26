import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import DemoManager from "@/components/agency/DemoManager";

export default async function DemosPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const [{ data: demos }, { data: packs }] = await Promise.all([
    db.from("agy_demo_projects").select("id, slug, business_name, industry_key, status, created_at").eq("agency_id", r.ctx.agencyId).order("created_at", { ascending: false }),
    db.from("agy_industry_packs").select("key, name").eq("is_active", true).order("name"),
  ]);
  return <div className="px-8 py-8 max-w-[1100px]"><h1 className="text-[24px] font-semibold tracking-tight">Demo Builder</h1><DemoManager initial={demos ?? []} packs={packs ?? []} /></div>;
}
