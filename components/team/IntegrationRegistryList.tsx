import type { Integration } from "@/lib/integrations/registry";

const COLOR: Record<Integration["status"], string> = { live: "#30D158", needs_setup: "#FFD60A", planned: "#6E6E73" };
const LABEL: Record<Integration["status"], string> = { live: "Live — shown on the site", needs_setup: "Needs setup — hidden from the site", planned: "Planned — hidden from the site" };

/** The registry as the owner audits it: what the public site is allowed to show, and why the rest is hidden. */
export default function IntegrationRegistryList({ items }: { items: Integration[] }) {
  return (
    <div className="mt-8 max-w-[900px]">
      <div className="text-[14px] font-semibold text-[#F5F5F7]">Integration registry</div>
      <div className="text-[12px] text-[#6E6E73] mt-1 mb-3">Single source for the homepage &quot;Plugs into your stack&quot; strip and the #agent row. Only <span className="text-[#30D158]">live</span> entries appear publicly. Edit in <span className="font-mono text-[11px] text-[#A1A1A6]">lib/integrations/registry.ts</span>.</div>
      <ul className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {items.map((i, idx) => (
          <li key={i.key} className="px-4 py-3 flex items-start justify-between gap-4" style={{ background: idx % 2 ? "#0A0A0A" : "#0E0E0E", borderTop: idx ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
            <div className="min-w-0">
              <div className="text-[13px] text-[#F5F5F7] font-medium">{i.name} <span className="text-[11px] text-[#6E6E73] font-normal">· {i.category}</span></div>
              <div className="text-[12px] text-[#A1A1A6] mt-0.5">{i.description}</div>
              {i.blocker && <div className="text-[11.5px] text-[#FFD60A]/80 mt-0.5">Blocker: {i.blocker}</div>}
              {i.connectsAt && <div className="text-[11px] text-[#6E6E73] mt-0.5">Connects at: {i.connectsAt}</div>}
            </div>
            <span className="shrink-0 inline-flex items-center gap-1.5 text-[11.5px]" style={{ color: COLOR[i.status] }}><span className="w-[6px] h-[6px] rounded-full" style={{ background: COLOR[i.status] }} />{LABEL[i.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
