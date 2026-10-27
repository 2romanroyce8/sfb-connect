import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import ClientsManager from "@/components/agency/ClientsManager";

export default async function ClientsPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient(); const ag = r.ctx.agencyId;
  const [{ data: clients }, { data: ob }, { data: members }] = await Promise.all([
    db.from("agy_clients").select("id, name, website, status, created_at").eq("agency_id", ag).order("created_at", { ascending: false }).limit(200),
    db.from("agy_onboarding").select("client_id, status, answers, review_note, submitted_at").eq("agency_id", ag),
    db.from("agy_client_members").select("client_id").eq("agency_id", ag),
  ]);
  const byOb = new Map((ob ?? []).map((o) => [o.client_id as string, o])); const joined = new Set((members ?? []).map((m) => m.client_id as string));
  const rows = (clients ?? []).map((c) => { const o = byOb.get(c.id as string); return { id: c.id as string, name: c.name as string, website: (c.website as string | null) ?? null, status: c.status as string, joined: joined.has(c.id as string), onboarding: (o?.status as string) ?? "draft", answers: ((o?.answers ?? {}) as Record<string, string>), note: (o?.review_note as string | null) ?? null }; });
  return <div className="px-8 py-8 max-w-[1100px]"><h1 className="text-[24px] font-semibold tracking-tight">Clients</h1><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">Add a client, send them an invite link, and review their onboarding. Links are copied to share yourself; nothing is emailed from here.</p><ClientsManager rows={rows} canManage={["owner", "admin", "sales_manager", "fulfillment_manager"].includes(r.ctx.role)} /></div>;
}
