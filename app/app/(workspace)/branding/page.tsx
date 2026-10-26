import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import BrandingForm from "@/components/agency/BrandingForm";

export default async function BrandingPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const { data: b } = await db.from("agency_branding").select("display_name, logo_url, primary_color, contact_email, website, booking_url").eq("agency_id", r.ctx.agencyId).maybeSingle();
  return <div className="px-8 py-8 max-w-[760px]"><h1 className="text-[24px] font-semibold tracking-tight">Branding</h1><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">Shown on every published demo page. Your demos never mention another agency.</p><BrandingForm initial={{ display_name: b?.display_name ?? r.ctx.agencyName, logo_url: b?.logo_url ?? "", primary_color: b?.primary_color ?? "", contact_email: b?.contact_email ?? "", website: b?.website ?? "", booking_url: b?.booking_url ?? "" }} canEdit={["owner", "admin"].includes(r.ctx.role)} /></div>;
}
