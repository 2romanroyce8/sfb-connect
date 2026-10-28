import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import OrdersManager from "@/components/agency/OrdersManager";

export default async function OrdersPage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient(); const ag = r.ctx.agencyId;
  const [{ data: orders }, { data: clients }, { data: services }] = await Promise.all([
    db.from("agy_orders").select("id, title, status, client_id, service_id, price_setup_cents, price_monthly_cents, cost_setup_cents, cost_monthly_cents, updated_at").eq("agency_id", ag).order("updated_at", { ascending: false }).limit(500),
    db.from("agy_clients").select("id, name").eq("agency_id", ag).order("name"),
    db.from("agy_services").select("id, name").eq("is_active", true).order("name"),
  ]);
  const cname = new Map((clients ?? []).map((c) => [c.id as string, c.name as string])); const sname = new Map((services ?? []).map((x) => [x.id as string, x.name as string]));
  const rows = (orders ?? []).map((o) => ({ id: o.id as string, title: o.title as string, status: o.status as string, client: cname.get(o.client_id as string) ?? "Client", service: o.service_id ? sname.get(o.service_id as string) ?? null : null, price_setup_cents: Number(o.price_setup_cents), price_monthly_cents: Number(o.price_monthly_cents), cost_setup_cents: Number(o.cost_setup_cents), cost_monthly_cents: Number(o.cost_monthly_cents) }));
  return <div className="px-8 py-8 max-w-[1200px]"><h1 className="text-[24px] font-semibold tracking-tight">Orders</h1><p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">Order a service for a client and track it from quote to live. You enter your own cost and your own retail price; margins are computed from your numbers. Delivery is done and tracked by your team.</p><OrdersManager rows={rows} clients={(clients ?? []).map((c) => ({ id: c.id as string, name: c.name as string }))} services={(services ?? []).map((x) => ({ id: x.id as string, name: x.name as string }))} /></div>;
}
