import Link from "next/link";

export default function OverviewPlanSummary({
  planLabel,
  creditBalance,
  activeAddonCount,
}: {
  planLabel: string;
  creditBalance: number;
  activeAddonCount: number;
}) {
  return (
    <section className="mb-10 border border-neutral-200 rounded-xl p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5">Current Plan</div>
        <div className="text-[14px] font-medium text-neutral-900">{planLabel}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5">Action Credits</div>
        <div className="text-[14px] font-medium text-neutral-900">{creditBalance}</div>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-0.5">Active Add-Ons</div>
        <div className="text-[14px] font-medium text-neutral-900">{activeAddonCount}</div>
      </div>
      <Link href="/dashboard/billing" className="ml-auto text-[12.5px] font-medium text-neutral-900 underline underline-offset-2">
        Manage Billing →
      </Link>
    </section>
  );
}
