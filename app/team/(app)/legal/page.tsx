import Link from "next/link";
import LegalDocument from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, unresolvedItems } from "@/lib/legal/documents";
export const dynamic = "force-dynamic";
export const metadata = { title: "Legal drafts" };

/** Team-only preview of the Privacy Policy and Terms drafts with every open
 * item highlighted. The public /privacy and /terms pages stay placeholders
 * until all items are resolved in lib/legal/documents.ts. */
export default function LegalPreviewPage({ searchParams }: { searchParams: { doc?: string } }) {
  const slug = searchParams.doc === "terms" ? "terms" : "privacy";
  const doc = LEGAL_DOCS[slug];
  return (
    <div className="px-6 py-8 max-w-[960px]">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Legal drafts</h1>
          <p className="text-[12.5px] text-[#A1A1A6] mt-1">Muse&apos;s drafts, as they will appear at <span className="font-mono text-[11.5px]">/privacy</span> and <span className="font-mono text-[11.5px]">/terms</span> once every open item is resolved.</p>
        </div>
        <div className="flex gap-1.5">
          {(["privacy", "terms"] as const).map((s) => {
            const n = unresolvedItems(LEGAL_DOCS[s]).length;
            return (
              <Link key={s} href={`/team/legal?doc=${s}`} className="h-[32px] px-3 inline-flex items-center gap-2 rounded-[8px] text-[12.5px]" style={{ background: s === slug ? "#F5F5F7" : "#101010", color: s === slug ? "#000" : "#F5F5F7", border: "1px solid rgba(255,255,255,0.1)" }}>
                {LEGAL_DOCS[s].title}
                <span className="text-[10.5px] px-1.5 py-0.5 rounded-full" style={{ background: n ? "rgba(255,214,10,0.2)" : "rgba(48,209,88,0.2)", color: n ? "#FFD60A" : "#30D158" }}>{n ? `${n} open` : "ready"}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="rounded-[14px] p-6 md:p-10" style={{ background: "#050505", border: "1px solid rgba(255,255,255,0.08)" }}>
        <LegalDocument doc={doc} mode="preview" />
      </div>
    </div>
  );
}
