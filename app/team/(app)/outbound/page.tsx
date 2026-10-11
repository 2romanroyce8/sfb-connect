import OutboundWorkspace from "@/components/team/OutboundWorkspace";

export const dynamic = "force-dynamic";

/** Outbound / GTM workspace: prospects → enrich → sequence → approval queue → send → track → book. Owner / overseer only (enforced in the API). */
export default function OutboundPage() {
  return (
    <div className="px-8 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Outbound</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Nothing is sent without a human approval on the row. Every charged step shows on the business&apos;s credit ledger.</div>
      </div>
      <OutboundWorkspace />
    </div>
  );
}
