import { getProjectForAdmin } from "@/lib/adminData";
import { PROJECT_STATUS_LABELS } from "@/lib/types";
import {
  StatusControl,
  ScoreForm,
  FindingForm,
  RecommendationForm,
  NoteForm,
  PublishReportForm,
} from "@/components/admin/AdminControls";

export default async function AdminProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getProjectForAdmin(params.id);

  if (!data) {
    return <div className="text-medium-gray">Project not found.</div>;
  }

  const { project, scores, audits, recommendations, statusHistory, notes, reports } = data;
  const business = (project as any).businesses;
  const latestScore = scores[0];

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-bold mb-1">{business?.legal_name}</h1>
        <p className="text-medium-gray text-sm">
          {business?.primary_category} · {business?.website}
        </p>
      </div>

      <div className="glass rounded-2xl p-6 mb-8">
        <div className="text-[12px] font-mono uppercase text-medium-gray mb-3">
          Current Status: {PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS]}
        </div>
        <StatusControl projectId={project.id} currentStatus={project.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold mb-4">Business Profile</h2>
          <dl className="text-sm space-y-2 text-medium-gray">
            <div><span className="text-white">Description:</span> {business?.description || "—"}</div>
            <div><span className="text-white">Years in business:</span> {business?.years_in_business || "—"}</div>
            <div><span className="text-white">Primary service:</span> {business?.business_services?.[0]?.primary_service || "—"}</div>
            <div><span className="text-white">Service areas:</span> {(business?.business_locations?.[0]?.service_areas || []).join(", ") || "—"}</div>
            <div><span className="text-white">Competitors:</span> {(business?.competitors || []).map((c: any) => c.name).join(", ") || "—"}</div>
          </dl>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold mb-4">Latest Score</h2>
          {latestScore ? (
            <div className="text-sm space-y-1 text-medium-gray">
              <div className="text-2xl font-mono font-semibold text-white mb-2">{latestScore.overall_score}/100</div>
              <div>Identity: {latestScore.identity_score}</div>
              <div>Knowledge: {latestScore.knowledge_score}</div>
              <div>Authority: {latestScore.authority_score}</div>
              <div>Location: {latestScore.location_score}</div>
              <div>Machine Readability: {latestScore.machine_readability_score}</div>
            </div>
          ) : (
            <p className="text-sm text-medium-gray">No score recorded yet.</p>
          )}
        </section>
      </div>

      <section className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-bold mb-4">Record AI Presence Score</h2>
        <ScoreForm projectId={project.id} />
      </section>

      <section className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-bold mb-4">Audit Findings</h2>
        <div className="mb-6 flex flex-col gap-3 max-h-[280px] overflow-y-auto">
          {audits.flatMap((a: any) => a.audit_findings || []).length === 0 ? (
            <p className="text-sm text-medium-gray">No findings yet.</p>
          ) : (
            audits.flatMap((a: any) => a.audit_findings || []).map((f: any) => (
              <div key={f.id} className="border border-white/10 rounded-xl p-4 text-sm">
                <div className="text-[11px] font-mono uppercase text-medium-gray mb-1">
                  {f.audit_categories?.name || "General"} · {f.severity}
                </div>
                <div>{f.finding}</div>
              </div>
            ))
          )}
        </div>
        <FindingForm projectId={project.id} />
      </section>

      <section className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-bold mb-4">Recommendations</h2>
        <div className="mb-6 flex flex-col gap-3 max-h-[280px] overflow-y-auto">
          {recommendations.length === 0 ? (
            <p className="text-sm text-medium-gray">No recommendations yet.</p>
          ) : (
            recommendations.map((r: any) => (
              <div key={r.id} className="border border-white/10 rounded-xl p-4 text-sm">
                <div className="text-[11px] font-mono uppercase text-medium-gray mb-1">
                  {r.priority} · {r.status}
                </div>
                <div className="font-medium">{r.title}</div>
              </div>
            ))
          )}
        </div>
        <RecommendationForm projectId={project.id} />
      </section>

      <section className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-bold mb-4">Publish Presence Report</h2>
        {reports[0] && (
          <p className="text-sm text-medium-gray mb-4">
            Last published: {new Date(reports[0].created_at).toLocaleString()}
          </p>
        )}
        <PublishReportForm projectId={project.id} />
      </section>

      <section className="glass rounded-2xl p-6 mb-8">
        <h2 className="font-bold mb-4">Internal Notes</h2>
        <div className="mb-6 flex flex-col gap-3 max-h-[240px] overflow-y-auto">
          {notes.length === 0 ? (
            <p className="text-sm text-medium-gray">No internal notes yet.</p>
          ) : (
            notes.map((n: any) => (
              <div key={n.id} className="border border-white/10 rounded-xl p-4 text-sm">
                <div className="text-[11px] font-mono uppercase text-medium-gray mb-1">
                  {new Date(n.created_at).toLocaleString()}
                </div>
                {n.note}
              </div>
            ))
          )}
        </div>
        <NoteForm projectId={project.id} />
      </section>

      <section className="glass rounded-2xl p-6">
        <h2 className="font-bold mb-4">Status History</h2>
        <div className="flex flex-col gap-2 text-sm text-medium-gray">
          {statusHistory.map((h: any) => (
            <div key={h.id}>
              {new Date(h.created_at).toLocaleString()} —{" "}
              <span className="text-white">
                {PROJECT_STATUS_LABELS[h.status as keyof typeof PROJECT_STATUS_LABELS]}
              </span>
              {h.note ? ` — ${h.note}` : ""}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
