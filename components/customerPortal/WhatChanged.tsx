import type { ChangeEvent } from "@/lib/customerPortal/progress";

export default function WhatChanged({ events }: { events: ChangeEvent[] }) {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">What Changed</h2>
      {events.length === 0 ? (
        <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">
          No recorded changes yet -- this fills in as more measurements come in over time.
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {events.map((e) => (
            <div key={e.id} className="p-4 flex items-center justify-between gap-4">
              <div className="text-[13px] text-neutral-900">{e.description}</div>
              <div className="text-[11px] text-neutral-400 shrink-0">
                {new Date(e.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
