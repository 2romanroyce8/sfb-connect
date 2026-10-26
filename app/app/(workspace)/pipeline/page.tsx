import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAgencyContext } from "@/lib/agency/context";
import { centsToUsd, type Stage } from "@/lib/agency/stages";

export default async function PipelinePage() {
  const r = await getAgencyContext(); if (r.status !== "ok") return null;
  const db = createSupabaseServerClient();
  const [{ data: leads }, { data: stages }] = await Promise.all([
    db.from("agy_leads").select("id, business_name, contact_name, city, stage, value_cents").eq("agency_id", r.ctx.agencyId).eq("archived", false).order("updated_at", { ascending: false }).limit(1000),
    db.from("agy_pipeline_stages").select("key, label, position, is_won, is_lost").eq("agency_id", r.ctx.agencyId).order("position"),
  ]);
  const st = (stages ?? []) as Stage[]; const by = (k: string) => (leads ?? []).filter((l) => l.stage === k);
  return (
    <div className="px-6 py-8">
      <h1 className="text-[24px] font-semibold tracking-tight px-2">Pipeline</h1>
      <p className="text-[13px] text-[color:var(--hx-a1a1a6)] mt-1 px-2">To move many leads at once, use Prospects → Select → Move to next stage.</p>
      <div className="flex gap-5 overflow-x-auto pb-4 mt-6">
        {st.map((s) => { const cards = by(s.key); const total = cards.reduce((a, c) => a + Number(c.value_cents ?? 0), 0);
          return (
            <div key={s.key} className="w-[280px] shrink-0">
              <div className="px-2 mb-1 text-[14px] font-medium uppercase tracking-tight">{s.label}</div>
              <div className="px-2 mb-3 text-[12px] text-[color:var(--hx-6e6e73)]">{cards.length} lead{cards.length === 1 ? "" : "s"}{total ? ` · ${centsToUsd(total)}` : ""}</div>
              <div className="flex flex-col gap-2.5 min-h-[40px]">
                {cards.map((c) => <Link key={c.id as string} href={`/app/leads/${c.id}`} className="rounded-[12px] p-3.5 block" style={{ background: "var(--hx-151515)", border: "1px solid rgb(var(--w) / 0.06)" }}><div className="text-[14px] font-medium truncate">{c.business_name}</div><div className="text-[11.5px] text-[color:var(--hx-6e6e73)] mt-1 truncate">{c.contact_name || c.city || "No contact yet"}{Number(c.value_cents) ? ` · ${centsToUsd(Number(c.value_cents))}` : ""}</div></Link>)}
              </div>
            </div>); })}
      </div>
    </div>
  );
}
