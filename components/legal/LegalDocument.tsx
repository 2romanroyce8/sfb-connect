import type { Block, LegalDoc, OpenItem } from "@/lib/legal/documents";
import { isPublishable, renderPublicText, splitText, unresolvedItems } from "@/lib/legal/documents";

/**
 * Renders a legal document in one of two modes.
 *  - public:  only legal when isPublishable(doc); tokens become resolutions.
 *  - preview: full draft for the team, every open item highlighted inline
 *             (yellow = still open, green = resolved) plus a checklist.
 * Public mode never renders an unpublishable document — the page falls back
 * to the placeholder before this component is reached (and renderPublicText
 * throws as a second line of defence).
 */
export default function LegalDocument({ doc, mode }: { doc: LegalDoc; mode: "public" | "preview" }) {
  const open = unresolvedItems(doc);
  const Text = ({ text }: { text: string }) => {
    if (mode === "public") return <>{renderPublicText(text, doc)}</>;
    return (
      <>
        {splitText(text, doc).map((p, i) =>
          p.kind === "text" ? <span key={i}>{p.text}</span> : <ItemChip key={i} item={p.item} />
        )}
      </>
    );
  };
  const renderBlock = (b: Block, i: number) => {
    if (b.kind === "h3") return <h3 key={i} className="mt-5 text-[14px] font-semibold text-white/[0.85]"><Text text={b.text} /></h3>;
    if (b.kind === "ul") return (
      <ul key={i} className="mt-3 list-disc pl-5 space-y-2">
        {b.items.map((it, j) => <li key={j} className="text-[15px] leading-[1.65] text-white/[0.72]"><Text text={it} /></li>)}
      </ul>
    );
    return <p key={i} className="mt-3 text-[15px] leading-[1.7] text-white/[0.72]"><Text text={b.text} /></p>;
  };
  const date = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

  return (
    <article className="max-w-[720px] mx-auto">
      {mode === "preview" && (
        <div className="mb-6 rounded-[12px] p-4" style={{ background: isPublishable(doc) ? "rgba(48,209,88,0.1)" : "rgba(255,214,10,0.1)", border: `1px solid ${isPublishable(doc) ? "rgba(48,209,88,0.35)" : "rgba(255,214,10,0.35)"}` }}>
          <div className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: isPublishable(doc) ? "#30D158" : "#FFD60A" }}>
            {isPublishable(doc) ? "Ready to publish — every open item is resolved" : `Draft — ${open.length} open item${open.length === 1 ? "" : "s"} · not shown on the public site`}
          </div>
          <div className="mt-1 text-[12.5px] text-white/[0.6]">Drafted by {doc.draftedBy}. Working draft, not legal advice — have a business attorney review before publishing. Resolve items in <span className="font-mono text-[11.5px] text-white/[0.8]">lib/legal/documents.ts</span>; the public page flips automatically on deploy.</div>
          {doc.openItems.length > 0 && (
            <ol className="mt-3 space-y-2">
              {doc.openItems.map((it) => (
                <li key={it.id} className="text-[12.5px] flex gap-2">
                  <span className="shrink-0 mt-[2px] w-[14px] h-[14px] rounded-[3px] inline-flex items-center justify-center text-[9px] font-bold" style={{ background: it.resolution ? "#30D158" : "transparent", border: `1px solid ${it.resolution ? "#30D158" : "rgba(255,214,10,0.7)"}`, color: "#000" }}>{it.resolution ? "✓" : ""}</span>
                  <span>
                    <span className="font-mono text-[11px] text-white/[0.5] mr-1.5">[{it.kind === "confirm" ? "TO CONFIRM" : "DECISION"} · {it.id}]</span>
                    <span className="text-white/[0.85]">{it.prompt}</span>
                    {it.workingDefault && <span className="block text-white/[0.5]">Working default: “{it.workingDefault}”</span>}
                    {it.note && <span className="block text-[#FFD60A]/80">Engineering note: {it.note}</span>}
                    {it.resolution && <span className="block text-[#30D158]">Resolved: “{it.resolution}”</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
      <h1 className="text-[32px] font-bold tracking-[-0.03em]">{doc.title}</h1>
      <p className="mt-2 text-[13px] text-white/[0.5]">Effective date: {date(doc.effectiveDate)} · Last updated: {date(doc.lastUpdated)}</p>
      {doc.intro.map(renderBlock)}
      {doc.sections.map((s) => (
        <section key={s.heading} className="mt-9">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">{s.heading}</h2>
          {s.blocks.map(renderBlock)}
        </section>
      ))}
    </article>
  );
}

function ItemChip({ item }: { item: OpenItem }) {
  const resolved = !!item.resolution?.trim();
  return (
    <mark
      title={`${item.kind === "confirm" ? "TO CONFIRM" : "DECISION"}: ${item.prompt}`}
      className="rounded px-1 py-[1px] text-[13px] font-medium"
      style={{ background: resolved ? "rgba(48,209,88,0.18)" : "rgba(255,214,10,0.2)", color: resolved ? "#30D158" : "#FFD60A" }}
    >
      {resolved ? item.resolution : `[${item.kind === "confirm" ? "TO CONFIRM" : "DECISION"}: ${item.workingDefault ?? item.prompt}]`}
    </mark>
  );
}
