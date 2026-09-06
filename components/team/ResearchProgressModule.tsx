"use client";

import { useEffect, useState } from "react";
import { Clock3, SearchCheck, Timer, RotateCcw, ArrowRight } from "lucide-react";
import { STAGE_HEADLINE, STAGE_MARKERS, STAGE_PROGRESS, type ResearchStage } from "@/lib/research/jobProgress";

type RunningProps = {
  mode: "running";
  compact?: boolean;
  stage: ResearchStage;
  progressPercent: number;
  sourcesFound: number;
  elapsedMs: number;
};

type CompleteBreakdownItem = { category: string; percent: number };

type CompleteProps = {
  mode: "complete";
  compact?: boolean;
  completenessPercent: number;
  breakdown?: CompleteBreakdownItem[];
  verifiedCount: number;
  sourcesCheckedCount: number;
  needsReviewCount: number;
  onViewResults?: () => void;
  onResearchMore?: () => void;
};

type FailedProps = {
  mode: "failed";
  lastStage: ResearchStage | null;
  reason: string;
  onRetry?: () => void;
};

type Props = RunningProps | CompleteProps | FailedProps;

function formatDuration(ms: number): string {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec} sec`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem > 0 ? `${min} min ${rem} sec` : `${min} min`;
}

// This is the ONLY place "estimated completion" is computed, and it is
// derived purely from this job's own observed pace (elapsed / progress so
// far) -- never a hardcoded guess. Below ~5% progress there isn't enough
// signal yet, so we say so honestly instead of showing a number.
function estimateRemaining(elapsedMs: number, progressPercent: number): string {
  if (progressPercent <= 4) return "Calculating…";
  const remainingPercent = Math.max(0, 100 - progressPercent);
  const msPerPercent = elapsedMs / progressPercent;
  const estMs = msPerPercent * remainingPercent;
  if (estMs < 3000) return "Almost done";
  return `≈${formatDuration(estMs)}`;
}

export default function ResearchProgressModule(props: Props) {
  if (props.mode === "failed") return <FailedModule {...props} />;
  if (props.compact) return <CompactModule {...props} />;
  if (props.mode === "running") return <RunningModule {...props} />;
  return <CompleteModule {...props} />;
}

function RunningModule({ stage, progressPercent, sourcesFound, elapsedMs }: RunningProps) {
  const [displayElapsed, setDisplayElapsed] = useState(elapsedMs);
  useEffect(() => setDisplayElapsed(elapsedMs), [elapsedMs]);
  useEffect(() => {
    const t = setInterval(() => setDisplayElapsed((v) => v + 1000), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="relative overflow-hidden w-full"
      style={{
        maxWidth: 920,
        minHeight: 260,
        background: "#050505",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 26,
        boxShadow: "0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.025)",
        padding: "34px 36px 28px",
      }}
    >
      <div className="uppercase" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "#6E6E73", marginBottom: 18 }}>
        Research In Progress
      </div>

      <div className="relative flex items-center" style={{ height: 92 }}>
        <div
          className="absolute left-0 right-0 overflow-hidden"
          style={{ height: 92, background: "#0B0B0B", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 3 }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: "linear-gradient(90deg, #4EDDC6 0%, #32C7B3 35%, #12695F 72%, rgba(9,44,40,0.15) 100%)",
              boxShadow: "0 0 34px rgba(78,221,198,0.18), inset 0 1px 0 rgba(255,255,255,0.10)",
              transition: "width 450ms cubic-bezier(0.22,1,0.36,1)",
            }}
          />
        </div>
        <div className="relative z-[3] flex items-baseline" style={{ marginLeft: "auto", marginRight: "8%" }}>
          <span style={{ fontFamily: "Inter, 'SF Pro Display', Helvetica Neue, Arial, sans-serif", fontSize: 78, fontWeight: 300, letterSpacing: "-0.05em", color: "#F5F5F7" }}>
            {progressPercent}
          </span>
          <span style={{ fontSize: 28, fontWeight: 400, color: "#D0D0D0", marginLeft: 8 }}>%</span>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 500, color: "#F5F5F7", marginTop: 18 }}>{STAGE_HEADLINE[stage]}</div>

      <StageDots stage={stage} />

      <div
        className="grid"
        style={{ gridTemplateColumns: "1.2fr 0.8fr 1fr", gap: 18, marginTop: 14, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <TelemetryItem icon={Clock3} label="Estimated Completion" value={estimateRemaining(displayElapsed, progressPercent)} />
        <TelemetryItem icon={SearchCheck} label="Sources Found" value={String(sourcesFound)} />
        <TelemetryItem icon={Timer} label="Elapsed Time" value={formatDuration(displayElapsed)} />
      </div>
    </div>
  );
}

function StageDots({ stage }: { stage: ResearchStage }) {
  const currentIdx = STAGE_PROGRESS[stage];
  return (
    <div className="flex items-center gap-5 mt-4">
      {STAGE_MARKERS.map((group) => {
        const groupMaxProgress = Math.max(...group.stages.map((s) => STAGE_PROGRESS[s]));
        const groupMinProgress = Math.min(...group.stages.map((s) => STAGE_PROGRESS[s]));
        const isComplete = currentIdx > groupMaxProgress;
        const isActive = currentIdx >= groupMinProgress && currentIdx <= groupMaxProgress;
        const color = isComplete ? "#30D158" : isActive ? "#20C7B7" : "#2A2A2A";
        return (
          <div key={group.label} className="flex items-center gap-1.5">
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, display: "inline-block", transition: "background 300ms" }} />
            <span style={{ fontSize: 10, color: isActive || isComplete ? "#A1A1A6" : "#727272" }}>{group.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function TelemetryItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="grid items-start" style={{ gridTemplateColumns: "22px 1fr", gap: 9 }}>
      <Icon size={17} style={{ color: "#D2D2D2", marginTop: 1 }} />
      <div>
        <div className="uppercase" style={{ fontSize: 10, fontWeight: 500, letterSpacing: "0.06em", color: "#6E6E73" }}>
          {label}
        </div>
        <div style={{ fontSize: 14, fontWeight: 500, color: "#EDEDED", marginTop: 3 }}>{value}</div>
      </div>
    </div>
  );
}

function CompleteModule({ completenessPercent, verifiedCount, sourcesCheckedCount, needsReviewCount, onViewResults, onResearchMore }: CompleteProps) {
  const isPartial = completenessPercent < 100;
  const accentColor = isPartial ? "#FFD60A" : "#30D158";
  return (
    <div
      className="relative overflow-hidden w-full"
      style={{
        maxWidth: 920,
        minHeight: 260,
        background: "#050505",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 26,
        boxShadow: "0 28px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.025)",
        padding: "34px 36px 28px",
      }}
    >
      <div className="uppercase" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "#6E6E73", marginBottom: 18 }}>
        Profile Research Complete
      </div>

      <div className="relative flex items-center" style={{ height: 92 }}>
        <div className="absolute left-0 right-0 overflow-hidden" style={{ height: 92, background: "#0B0B0B", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 3 }}>
          <div
            style={{
              height: "100%",
              width: `${completenessPercent}%`,
              background: isPartial
                ? "linear-gradient(90deg, #FFD60A 0%, #C79A0A 60%, rgba(90,70,10,0.2) 100%)"
                : "linear-gradient(90deg, #4EDDC6 0%, #32C7B3 35%, #12695F 72%, rgba(9,44,40,0.15) 100%)",
              boxShadow: `0 0 34px ${isPartial ? "rgba(255,214,10,0.15)" : "rgba(78,221,198,0.18)"}, inset 0 1px 0 rgba(255,255,255,0.10)`,
            }}
          />
        </div>
        <div className="relative z-[3] flex items-baseline" style={{ marginLeft: "auto", marginRight: "8%" }}>
          <span style={{ fontFamily: "Inter, 'SF Pro Display', Helvetica Neue, Arial, sans-serif", fontSize: 78, fontWeight: 300, letterSpacing: "-0.05em", color: "#F5F5F7" }}>
            {completenessPercent}
          </span>
          <span style={{ fontSize: 28, fontWeight: 400, color: "#D0D0D0", marginLeft: 8 }}>%</span>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 500, color: accentColor, marginTop: 18 }}>
        {isPartial ? "Research complete — some information could not be verified" : "Research complete"}
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginTop: 14, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.05)" }}
      >
        <TelemetryItem icon={SearchCheck} label="Verified Fields" value={String(verifiedCount)} />
        <TelemetryItem icon={SearchCheck} label="Sources Checked" value={String(sourcesCheckedCount)} />
        <TelemetryItem icon={Clock3} label="Needs Review" value={String(needsReviewCount)} />
      </div>

      {(onViewResults || onResearchMore) && (
        <div className="flex gap-2.5 mt-6">
          {onViewResults && (
            <button
              onClick={onViewResults}
              className="inline-flex items-center gap-1.5"
              style={{ height: 42, padding: "0 18px", background: "#F5F5F7", color: "#111111", borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              View Results <ArrowRight size={14} />
            </button>
          )}
          {onResearchMore && (
            <button
              onClick={onResearchMore}
              className="inline-flex items-center gap-1.5"
              style={{ height: 42, padding: "0 18px", background: "transparent", border: "1px solid rgba(255,255,255,0.14)", color: "#D2D2D2", borderRadius: 8, fontSize: 14, fontWeight: 600 }}
            >
              Research More
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FailedModule({ lastStage, reason, onRetry }: FailedProps) {
  return (
    <div
      className="relative overflow-hidden w-full"
      style={{
        maxWidth: 920,
        minHeight: 200,
        background: "#050505",
        border: "1px solid rgba(255,69,58,0.25)",
        borderRadius: 26,
        boxShadow: "0 28px 80px rgba(0,0,0,0.45)",
        padding: "34px 36px 28px",
      }}
    >
      <div className="uppercase" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", color: "#6E6E73", marginBottom: 18 }}>
        Research In Progress
      </div>
      <div className="relative flex items-center" style={{ height: 92 }}>
        <div className="absolute left-0 right-0" style={{ height: 92, background: "#0B0B0B", border: "1px solid rgba(255,255,255,0.03)", borderRadius: 3 }}>
          <div style={{ height: "100%", width: "100%", background: "#3A3A3A" }} />
        </div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: "#FF453A", marginTop: 18 }}>Research interrupted</div>
      <div style={{ fontSize: 12.5, color: "#A1A1A6", marginTop: 6 }}>
        {lastStage ? `Last completed stage: ${STAGE_HEADLINE[lastStage]}. ` : ""}
        {reason}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 mt-5"
          style={{ height: 40, padding: "0 16px", background: "#151515", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F5F7", borderRadius: 8, fontSize: 13, fontWeight: 600 }}
        >
          <RotateCcw size={14} /> Retry Research
        </button>
      )}
    </div>
  );
}

// Compact widget: the 230x88 header replacement in ResearchResultView, and
// the in-progress card on the Research Queue list.
function CompactModule(props: RunningProps | CompleteProps) {
  const isRunning = props.mode === "running";
  const percent = isRunning ? props.progressPercent : props.completenessPercent;
  const isPartial = !isRunning && props.completenessPercent < 100;
  const fillColor = isRunning ? "#20C7B7" : isPartial ? "#FFD60A" : "#20C7B7";
  const label = isRunning ? STAGE_HEADLINE[props.stage].toUpperCase() : "RESEARCH COMPLETE";
  return (
    <div style={{ width: 230, height: 88, background: "#090909", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "12px 14px" }}>
      <div className="flex items-baseline">
        <span style={{ fontSize: 34, fontWeight: 400, color: "#F5F5F7" }}>{percent}</span>
        <span style={{ fontSize: 15, color: "#A1A1A6", marginLeft: 4 }}>%</span>
      </div>
      <div style={{ height: 5, background: "#171717", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${percent}%`, background: fillColor, transition: "width 400ms ease" }} />
      </div>
      <div className="uppercase truncate" style={{ fontSize: 9.5, color: "#6E6E73", marginTop: 6, letterSpacing: "0.06em" }}>
        {label}
      </div>
    </div>
  );
}
