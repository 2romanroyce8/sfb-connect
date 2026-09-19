import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCustomerContext } from "@/lib/customerPortal/context";
import { getReportDetail } from "@/lib/customerPortal/reports";

export default async function ReportDetailPage({ params }: { params: { id: string } }) {
  const result = await getCustomerContext(`/dashboard/reports/${params.id}`);
  if (result.status === "no_customer") redirect("/dashboard/no-membership");
  const { context } = result;

  // getReportDetail scopes by business_id -- a report id belonging to
  // another business simply returns null here, never leaks.
  const report = await getReportDetail(context.business.id, params.id);
  if (!report) notFound();

  return (
    <div>
      <Link href="/dashboard/reports" className="text-[12.5px] text-neutral-500 mb-4 inline-block">
        ← Back to Reports
      </Link>
      <h1 className="text-[22px] font-semibold text-neutral-900 mb-1">{report.reportType ? report.reportType.replace(/_/g, " ") : "Report"}</h1>
      <div className="text-[12.5px] text-neutral-400 mb-8">
        {report.publishedAt && new Date(report.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </div>

      {report.summary && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-2">Executive Summary</h2>
          <p className="text-[13.5px] text-neutral-700 leading-relaxed">{report.summary}</p>
        </section>
      )}

      {report.presenceScore && (
        <section className="mb-8 border border-neutral-200 rounded-xl p-5">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400 mb-1">AI Presence Score</div>
          <div className="text-[24px] font-semibold text-neutral-900">{report.presenceScore.overall_score} / 100</div>
        </section>
      )}

      {report.findings.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Findings</h2>
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {report.findings.map((f) => (
              <div key={f.id} className="p-4 flex items-center justify-between gap-4">
                <div className="text-[13px] text-neutral-900">{f.finding}</div>
                <span className="text-[10.5px] text-neutral-400 shrink-0">{f.resolved ? "Resolved" : f.severity}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.recommendations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Recommended Next Steps</h2>
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {report.recommendations.map((r) => (
              <div key={r.id} className="p-4 text-[13px] text-neutral-900">
                {r.title}
              </div>
            ))}
          </div>
        </section>
      )}

      {report.fileUrl ? (
        <a href={report.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full bg-neutral-900 text-white text-[13px] font-medium px-5">
          Download Report
        </a>
      ) : (
        <p className="text-[12px] text-neutral-400">This report is available for in-app viewing only.</p>
      )}
    </div>
  );
}
