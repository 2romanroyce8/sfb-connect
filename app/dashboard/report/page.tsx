import { getCurrentCustomerContext } from "@/lib/dashboardData";

export default async function ReportPage() {
  const ctx = await getCurrentCustomerContext();
  const report = ctx?.report;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Presence Report</h1>
      <p className="text-medium-gray mb-10 max-w-[560px]">
        Your completed audit, optimization summary, AI Presence Score and
        prioritized recommendations — delivered on day 14.
      </p>

      {!report ? (
        <div className="glass rounded-[28px] p-10 text-medium-gray">
          Your Presence Report is not ready yet. It will be published here
          once your analysis reaches its final review stage.
        </div>
      ) : (
        <div className="glass rounded-[28px] p-10">
          <div className="text-sm text-medium-gray mb-4 font-mono">
            Published{" "}
            {report.published_at
              ? new Date(report.published_at).toLocaleDateString()
              : ""}
          </div>
          {report.summary && (
            <p className="text-[15px] leading-relaxed mb-8">{report.summary}</p>
          )}
          {report.file_url && (
            <a
              href={report.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-black px-6 py-3 rounded-full text-sm font-semibold inline-block"
            >
              Download Full Report
            </a>
          )}
        </div>
      )}
    </div>
  );
}
