import Link from "next/link";
import { getCurrentCustomerContext } from "@/lib/dashboardData";
import StatusTracker from "@/components/dashboard/StatusTracker";
import { PROJECT_STATUS_LABELS } from "@/lib/types";

export default async function DashboardOverviewPage() {
  const ctx = await getCurrentCustomerContext();

  if (!ctx || !ctx.business || !ctx.project) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-4">No business on file yet</h1>
        <p className="text-medium-gray mb-6 max-w-[480px]">
          Finish the onboarding intake to start your 14-day AI Presence
          analysis.
        </p>
        <Link
          href="/onboarding"
          className="bg-white text-black px-6 py-3 rounded-full text-sm font-semibold inline-block"
        >
          Complete Onboarding
        </Link>
      </div>
    );
  }

  const { business, project, score, membership } = ctx;

  const daysRemaining = project.target_completion_at
    ? Math.max(
        0,
        Math.ceil(
          (new Date(project.target_completion_at).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <div>
      <h1 className="text-3xl font-bold mb-1">{business.legal_name}</h1>
      <p className="text-medium-gray mb-10">
        {business.primary_category || "AI Presence Overview"}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div className="glass rounded-2xl p-5">
          <div className="text-[12px] text-medium-gray mb-2 font-mono uppercase">Status</div>
          <div className="text-lg font-semibold">{PROJECT_STATUS_LABELS[project.status]}</div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[12px] text-medium-gray mb-2 font-mono uppercase">Days Remaining</div>
          <div className="text-lg font-semibold font-mono">
            {daysRemaining !== null ? daysRemaining : "—"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[12px] text-medium-gray mb-2 font-mono uppercase">Presence Score</div>
          <div className="text-lg font-semibold font-mono">
            {score ? `${score.overall_score} / 100` : "Pending"}
          </div>
        </div>
        <div className="glass rounded-2xl p-5">
          <div className="text-[12px] text-medium-gray mb-2 font-mono uppercase">Renewal</div>
          <div className="text-lg font-semibold font-mono">
            {membership?.renews_at
              ? new Date(membership.renews_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "—"}
          </div>
        </div>
      </div>

      <div className="glass rounded-[28px] p-8 mb-12">
        <h2 className="text-lg font-bold mb-6">Analysis Status</h2>
        <StatusTracker status={project.status} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link href="/dashboard/score" className="glass rounded-2xl p-6 hover:bg-white/[0.08] transition-colors">
          <div className="font-semibold mb-1">AI Presence Score</div>
          <div className="text-sm text-medium-gray">See your identity, knowledge, authority, location and machine-readability breakdown.</div>
        </Link>
        <Link href="/dashboard/recommendations" className="glass rounded-2xl p-6 hover:bg-white/[0.08] transition-colors">
          <div className="font-semibold mb-1">Recommendations</div>
          <div className="text-sm text-medium-gray">Prioritized actions to strengthen how AI understands your business.</div>
        </Link>
      </div>
    </div>
  );
}
