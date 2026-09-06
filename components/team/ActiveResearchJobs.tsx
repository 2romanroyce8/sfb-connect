"use client";

import { useEffect, useState } from "react";
import ResearchProgressModule from "./ResearchProgressModule";
import type { ResearchStage } from "@/lib/research/jobProgress";

type ActiveJob = {
  id: string;
  started_for: string | null;
  status: string;
  current_step: ResearchStage;
  progress_percent: number;
  sources_found: number;
  created_at: string;
};

// Polls (every 2.5s) rather than holding a live connection — this page is
// meant to reflect jobs started elsewhere (a different tab, or by another
// rep if the viewer is the owner), not just the job that opened this page.
export default function ActiveResearchJobs() {
  const [jobs, setJobs] = useState<ActiveJob[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch("/api/team/research/jobs/active");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setJobs(data.jobs || []);
      } catch {
        // transient network hiccup — next poll will recover
      }
    }
    poll();
    const t = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Currently Researching ({jobs.length})</div>
      <div className="flex flex-wrap gap-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-[14px] p-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[12px] text-[#A1A1A6] truncate max-w-[210px] mb-2 px-0.5">{job.started_for || "Researching…"}</div>
            <ResearchProgressModule mode="running" compact stage={job.current_step} progressPercent={job.progress_percent} sourcesFound={job.sources_found} elapsedMs={Date.now() - new Date(job.created_at).getTime()} />
          </div>
        ))}
      </div>
    </div>
  );
}
