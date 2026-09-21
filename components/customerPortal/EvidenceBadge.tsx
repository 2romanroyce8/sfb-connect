import type { PresenceScoreSnapshot } from "@/lib/customerPortal/overview";

const STYLE: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-neutral-50 text-neutral-700 border-neutral-200",
  low: "bg-amber-50 text-amber-700 border-amber-200",
  insufficient: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

/**
 * Evidence sufficiency shown WITH every score -- a 90 built on 2
 * observations must never look as authoritative as a 90 built on 40.
 * Legacy manually-entered scores have no evidence fields; for those the
 * badge is omitted rather than invented.
 */
export default function EvidenceBadge({ score }: { score: PresenceScoreSnapshot }) {
  if (!score.evidence_confidence) return null;
  const label = score.evidence_confidence.charAt(0).toUpperCase() + score.evidence_confidence.slice(1);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-[11.5px] text-neutral-500">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${STYLE[score.evidence_confidence]}`}>Evidence confidence: {label}</span>
      {score.valid_observation_count != null && <span>{score.valid_observation_count} valid observations</span>}
      {score.platforms_tested_count != null && <span>{score.platforms_tested_count} / 5 platforms tested</span>}
      {score.queries_tested_count != null && <span>{score.queries_tested_count} queries tested</span>}
    </div>
  );
}
