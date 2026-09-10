"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResearchProgressModule from "./ResearchProgressModule";
import LeadResearchCommandBar from "./LeadResearchCommandBar";
import ResearchUsageBar from "./ResearchUsageBar";
import type { ResearchStage } from "@/lib/research/jobProgress";
import type { ResearchScope } from "@/lib/research/LeadProfileBuilder";

type JobState =
  | { mode: "idle" }
  | { mode: "running"; stage: ResearchStage; progressPercent: number; sourcesFound: number; elapsedMs: number }
  | {
      mode: "complete";
      resultId: string;
      completenessPercent: number;
      breakdown?: { category: string; percent: number }[];
      verifiedCount: number;
      sourcesCheckedCount: number;
      needsReviewCount: number;
    }
  | { mode: "failed"; lastStage: ResearchStage | null; reason: string };

export default function LeadImportForm() {
  const router = useRouter();
  const [job, setJob] = useState<JobState>({ mode: "idle" });
  const lastSubmitRef = useRef<{ sources: string[]; scope: ResearchScope } | null>(null);

  // Real Server-Sent Events over a POST fetch stream — every event pushed
  // here mirrors a crm_research_jobs row update the backend just wrote, so
  // the percentage on screen is never a client-side simulation.
  async function runResearch(sources: string[], scope: ResearchScope) {
    lastSubmitRef.current = { sources, scope };
    setJob({ mode: "running", stage: "QUEUED", progressPercent: 2, sourcesFound: 0, elapsedMs: 0 });

    try {
      const res = await fetch("/api/team/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources, scope }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Research failed to start.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          const evt = JSON.parse(line.slice(5).trim());
          if (evt.type === "stage" || evt.type === "job_created") {
            setJob({ mode: "running", stage: evt.stage, progressPercent: evt.progressPercent, sourcesFound: evt.sourcesFound, elapsedMs: evt.elapsedMs });
          } else if (evt.type === "done") {
            setJob({
              mode: "complete",
              resultId: evt.resultId,
              completenessPercent: evt.completeness,
              breakdown: evt.breakdown,
              verifiedCount: evt.verifiedCount,
              sourcesCheckedCount: evt.sourcesCheckedCount,
              needsReviewCount: evt.needsReviewCount,
            });
          } else if (evt.type === "error") {
            setJob({ mode: "failed", lastStage: evt.lastStage ?? null, reason: evt.message });
          }
        }
      }
    } catch (err) {
      setJob({ mode: "failed", lastStage: null, reason: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  function retry() {
    if (lastSubmitRef.current) runResearch(lastSubmitRef.current.sources, lastSubmitRef.current.scope);
  }

  return (
    <div className="relative overflow-hidden" style={{ background: "#050505", minHeight: "calc(100vh - 1px)" }}>
      {/* Atmosphere — soft, luxurious, not neon */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 70% 58%, rgba(90,160,40,0.045), transparent 26%), radial-gradient(circle at 50% 45%, rgba(255,255,255,0.018), transparent 42%), linear-gradient(to bottom, rgba(255,255,255,0.008), rgba(0,0,0,0.24))",
        }}
      />

      <div
        className="relative w-full mx-auto flex flex-col items-center justify-center"
        style={{ minHeight: "calc(100vh - 72px)", padding: "0 32px 110px", boxSizing: "border-box", overflow: "hidden" }}
      >
        {job.mode === "idle" && (
          <div style={{ width: "100%", maxWidth: 820, transform: "translateY(60px)" }}>
            <ResearchUsageBar />
            <LeadResearchCommandBar onSubmit={runResearch} />
          </div>
        )}

        {job.mode !== "idle" && (
          <div className="w-full">
            {job.mode === "running" && (
              <ResearchProgressModule mode="running" stage={job.stage} progressPercent={job.progressPercent} sourcesFound={job.sourcesFound} elapsedMs={job.elapsedMs} />
            )}
            {job.mode === "complete" && (
              <ResearchProgressModule
                mode="complete"
                completenessPercent={job.completenessPercent}
                breakdown={job.breakdown}
                verifiedCount={job.verifiedCount}
                sourcesCheckedCount={job.sourcesCheckedCount}
                needsReviewCount={job.needsReviewCount}
                onViewResults={() => router.push(`/team/research/${job.resultId}`)}
                onResearchMore={() => router.push(`/team/research/${job.resultId}?more=1`)}
              />
            )}
            {job.mode === "failed" && <ResearchProgressModule mode="failed" lastStage={job.lastStage} reason={job.reason} onRetry={retry} />}

            {job.mode !== "running" && (
              <button onClick={() => setJob({ mode: "idle" })} className="mt-4 text-[12.5px] text-[#6E6E73] hover:text-white">
                ← Research another business
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
