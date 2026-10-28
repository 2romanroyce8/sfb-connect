import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { canMove, gateFor, toCents, STATUS_LABEL, type OrderStatus } from "@/lib/agency/orders";
export const dynamic = "force-dynamic";

// Fulfillment actions. Agency from the membership; every write through the SESSION client so RLS decides (and costs/margins stay staff-only).
// Gates are re-checked here from real data. Nothing here contacts a vendor or a client: fulfillment is manual and tracked, not automated.
const UUID = /^[0-9a-f-]{36}$/i; const STAFF = ["owner", "admin", "sales_manager", "fulfillment_manager"];
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
const SEED_TASKS = ["Confirm scope and what's included", "Collect what we need from the client", "Build or configure", "Test it end to end", "Walk the client through it", "Launch"];

export async function POST(req: NextRequest) {
  const r = await getAgencyContext(); if (r.status !== "ok") return fail("Not signed in to an agency.", 401);
  if (!STAFF.includes(r.ctx.role)) return fail("Your role can't manage orders.", 403);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>; const db = createSupabaseServerClient(); const ag = r.ctx.agencyId; const me = r.ctx.userId;
  const ev = (order_id: string, kind: string, body: string) => db.from("agy_order_events").insert({ agency_id: ag, order_id, kind, body, created_by: me });
  const load = async (id: string) => (UUID.test(id) ? (await db.from("agy_orders").select("id, client_id, status, price_setup_cents, price_monthly_cents").eq("id", id).eq("agency_id", ag).maybeSingle()).data : null);
  switch (b.action) {
    case "create": {
      const client_id = s(b.client_id, 40), title = s(b.title, 160); if (!UUID.test(client_id) || title.length < 2) return fail("Pick a client and name the order.");
      const service_id = s(b.service_id, 40); if (service_id && !UUID.test(service_id)) return fail("Unknown service.");
      const { count } = await db.from("agy_orders").select("id", { count: "exact", head: true }).eq("agency_id", ag); if ((count ?? 0) >= 500) return fail("You've reached the 500-order limit.", 429);
      const { data: c } = await db.from("agy_clients").select("id").eq("id", client_id).eq("agency_id", ag).maybeSingle(); if (!c) return fail("Client not found.", 404);
      const { data, error } = await db.from("agy_orders").insert({ agency_id: ag, client_id, service_id: service_id || null, title, created_by: me }).select("id").single();
      if (error) return fail(error.code === "42501" ? "Your role can't create orders." : error.message);
      await ev(data.id as string, "created", "Order created");
      await db.from("agy_order_tasks").insert(SEED_TASKS.map((t, i) => ({ agency_id: ag, order_id: data.id, title: t, position: i })));
      return NextResponse.json({ ok: true, id: data.id });
    }
    case "quote": {
      const id = s(b.order_id, 40); const o = await load(id); if (!o) return fail("Order not found.", 404);
      const cs = toCents(b.cost_setup), cm = toCents(b.cost_monthly), ps = toCents(b.price_setup), pm = toCents(b.price_monthly);
      if ([cs, cm, ps, pm].some((x) => x === null)) return fail("Enter each amount as a number, zero or more.");
      if (["live", "maintenance", "canceled"].includes(o.status as string)) return fail("This order can't be re-priced in its current status.", 409);
      const { error } = await db.from("agy_orders").update({ cost_setup_cents: cs, cost_monthly_cents: cm, price_setup_cents: ps, price_monthly_cents: pm, notes: s(b.notes, 4000), updated_at: new Date().toISOString() }).eq("id", id).eq("agency_id", ag);
      if (error) return fail(error.message); await ev(id, "quote", "Pricing updated"); return NextResponse.json({ ok: true });
    }
    case "status": {
      const id = s(b.order_id, 40), to = s(b.to, 30); const o = await load(id); if (!o) return fail("Order not found.", 404);
      const mv = canMove(o.status as string, to); if (!mv.ok) return fail(mv.reason, 409);
      const { data: ob } = await db.from("agy_onboarding").select("status").eq("client_id", o.client_id).maybeSingle();
      const why = gateFor(to, { price_setup_cents: Number(o.price_setup_cents), price_monthly_cents: Number(o.price_monthly_cents) }, ob?.status === "approved"); if (why) return fail(why, 409);
      const { data, error } = await db.from("agy_orders").update({ status: to, updated_at: new Date().toISOString() }).eq("id", id).eq("agency_id", ag).eq("status", o.status as string).select("id");
      if (error) return fail(error.message); if (!data?.length) return fail("That order changed while you were working. Reload and try again.", 409);
      await ev(id, "status", `${STATUS_LABEL[o.status as OrderStatus]} → ${STATUS_LABEL[to as OrderStatus]}`); return NextResponse.json({ ok: true });
    }
    case "note": { const id = s(b.order_id, 40), body = s(b.body, 2000); if (!UUID.test(id) || !body) return fail("Write a note first."); const o = await load(id); if (!o) return fail("Order not found.", 404); const { error } = await ev(id, "note", body); if (error) return fail(error.message); return NextResponse.json({ ok: true }); }
    case "task_add": { const id = s(b.order_id, 40), title = s(b.title, 200); if (!UUID.test(id) || !title) return fail("Name the task."); const o = await load(id); if (!o) return fail("Order not found.", 404); const { count } = await db.from("agy_order_tasks").select("id", { count: "exact", head: true }).eq("order_id", id); const { error } = await db.from("agy_order_tasks").insert({ agency_id: ag, order_id: id, title, position: count ?? 0 }); if (error) return fail(error.code === "42501" ? "Your role can't edit tasks." : error.message); return NextResponse.json({ ok: true }); }
    case "task_toggle": {
      const tid = s(b.task_id, 40); if (!UUID.test(tid)) return fail("Unknown task."); const done = b.done === true;
      const { data, error } = await db.from("agy_order_tasks").update({ done_at: done ? new Date().toISOString() : null, done_by: done ? me : null }).eq("id", tid).eq("agency_id", ag).select("id, order_id, title");
      if (error) return fail(error.code === "42501" ? "Your role can't edit tasks." : error.message); if (!data?.length) return fail("Task not found.", 404);
      await ev(data[0].order_id as string, "task", `${done ? "Done" : "Reopened"}: ${data[0].title}`); return NextResponse.json({ ok: true });
    }
  }
  return fail("Unknown action.");
}
