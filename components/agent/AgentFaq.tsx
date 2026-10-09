"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { AGENT_FAQ } from "@/lib/agentProgram/config";

export default function AgentFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="flex flex-col gap-2.5">
      {AGENT_FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="rounded-[11px] overflow-hidden border transition-colors" style={{ background: isOpen ? "#111111" : "#0c0c0c", borderColor: isOpen ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)" }}>
            <button onClick={() => setOpen(isOpen ? null : i)} className="w-full min-h-[58px] px-[18px] flex items-center justify-between gap-4 text-left" aria-expanded={isOpen}>
              <span className="text-[14px] font-medium leading-[1.35] text-white">{f.q}</span>
              <Plus size={18} strokeWidth={1.8} className="shrink-0 transition-transform duration-200" style={{ color: "#30D158", transform: isOpen ? "rotate(45deg)" : "none" }} />
            </button>
            {isOpen && <p className="px-[18px] pb-[18px] text-[12.5px] leading-[1.6] text-white/[0.5] max-w-[90%]">{f.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
