import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";

export default async function AgencyOverview() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const [demos, published, clients, events] = await Promise.all([
    db.from("agy_demo_projects").select("id", { count: "exact", head: true }).eq("agency_id", r.ctx.agencyId),
    db.from("agy_demo_projects").select("id", { count: "exact", head: true }).eq("agency_id", r.ctx.agencyId).eq("status", "published"),
    db.from("agy_clients").select("id", { count: "exact", head: true }).eq("agency_id", r.ctx.agencyId),
    db.from("agy_demo_events").select("id", { count: "exact", head: true }).eq("agency_id", r.ctx.agencyId).eq("event", "demo_opened"),
  ]);
  const card = "rounded-[14px] p-5";
  const stat = (label: string, v: number | null) => <div className={card} style={{ background: "var(--hx-111111)", border: "1px solid rgb(var(--w) / 0.07)" }}><div className="text-[12px] text-[color:var(--hx-6e6e73)] uppercase tracking-wide">{label}</div><div className="text-[28px] font-semibold mt-1">{v ?? 0}</div></div>;
  return (
    <div className="px-8 py-8 max-w-[1100px]">
      <h1 className="text-[24px] font-semibold tracking-tight">{r.ctx.agencyName}</h1>
      <p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1">Every number below is counted from your own records. Nothing is estimated.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">{stat("Demos", demos.count)}{stat("Published", published.count)}{stat("Demo views", events.count)}{stat("Clients", clients.count)}</div>
      <div className="mt-6"><Link href="/app/demos" className="inline-flex h-[38px] px-4 items-center rounded-[8px] bg-white text-black text-[12.5px] font-semibold">Build a demo</Link></div>
    </div>
  );
}
