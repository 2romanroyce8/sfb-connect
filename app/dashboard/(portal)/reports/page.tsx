import { redirect } from "next/navigation";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getReports } from "@/lib/customerPortal/reports";

const TYPE_LABEL: Record<string, string> = {
  initial: "Initial AI Presence Audit",
  monthly: "Monthly Presence Report",
  quarterly: "Quarterly Report",
  competitor: "Competitor Report",
  ai_visibility: "AI Visibility Report",
  website_ai_readiness: "Website AI Readiness Report",
  knowledge_coverage: "Knowledge Coverage Report",
};

export default async function ReportsPage() {
  const result = await getCustomerContext("/dashboard/reports");
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  const reports = await getReports(context.business.id);
  const published = reports.filter((r) => r.publishedAt);

  return (
    <div>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-6">Reports</h1>
      {published.length === 0 ? (
        <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">
          No reports yet. Your first report will appear here after SFB completes the required analysis.
        </div>
      ) : (
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          {published.map((r) => (
            <Link key={r.id} href={`/dashboard/reports/${r.id}`} className="p-4 flex items-center justify-between gap-4 hover:bg-neutral-50">
              <div>
                <div className="text-[13px] font-medium text-neutral-900">{r.reportType ? TYPE_LABEL[r.reportType] || r.reportType : "Report"}</div>
                <div className="text-[11.5px] text-neutral-400 mt-0.5">
                  {r.periodStart && r.periodEnd
                    ? `${new Date(r.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(r.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : new Date(r.publishedAt!).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <span className="text-[11px] font-medium text-neutral-500 shrink-0">View →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
