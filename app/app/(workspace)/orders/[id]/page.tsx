import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import OrderDetail from "@/components/agency/OrderDetail";

export default async function OrderPage({ params }: { params: { id: string } }) {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const db = createSupabaseServerClient();
  const { data: o } = await db.from("agy_orders").select("id, title, status, client_id, service_id, cost_setup_cents, cost_monthly_cents, price_setup_cents, price_monthly_cents, notes, created_at").eq("id", params.id).eq("agency_id", r.ctx.agencyId).maybeSingle();
  if (!o) notFound();
  const [{ data: client }, { data: ob }, { data: tasks }, { data: events }, { data: svc }] = await Promise.all([
    db.from("agy_clients").select("name").eq("id", o.client_id).maybeSingle(), db.from("agy_onboarding").select("status").eq("client_id", o.client_id).maybeSingle(),
    db.from("agy_order_tasks").select("id, title, done_at, position").eq("order_id", params.id).order("position"), db.from("agy_order_events").select("id, kind, body, created_at").eq("order_id", params.id).order("created_at", { ascending: false }).limit(100),
    o.service_id ? db.from("agy_services").select("name, description").eq("id", o.service_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return <div className="px-8 py-8 max-w-[1000px]"><Link href="/app/orders" className="text-[12.5px] text-[color:var(--hx-a1a1a6)] hover:underline">← Orders</Link><OrderDetail order={o as never} clientName={(client?.name as string) ?? "Client"} onboardingApproved={ob?.status === "approved"} service={(svc as { name: string; description: string } | null) ?? null} tasks={(tasks ?? []) as never} events={(events ?? []) as never} /></div>;
}
