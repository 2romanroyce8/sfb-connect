"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Search } from "lucide-react";
import ResearchProgressModule from "./ResearchProgressModule";
import type { ResearchStage } from "@/lib/research/jobProgress";

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
  const [sources, setSources] = useState<string[]>([""]);
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<JobState>({ mode: "idle" });
  const lastSubmitRef = useRef<{ sources: string[]; location: string } | null>(null);

  function updateSource(i: number, value: string) {
    setSources((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }

  function addSource() {
    setSources((prev) => [...prev, ""]);
  }

  function removeSource(i: number) {
    setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Real Server-Sent Events over a POST fetch stream — every event pushed
  // here mirrors a crm_research_jobs row update the backend just wrote, so
  // the percentage on screen is never a client-side simulation.
  async function runResearch(cleanedSources: string[], cleanedLocation: string) {
    lastSubmitRef.current = { sources: cleanedSources, location: cleanedLocation };
    setError(null);
    setJob({ mode: "running", stage: "QUEUED", progressPercent: 2, sourcesFound: 0, elapsedMs: 0 });

    try {
      const res = await fetch("/api/team/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: cleanedSources, location: cleanedLocation }),
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = sources.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Add at least one source — a website, Google Business profile, or social page.");
      return;
    }
    await runResearch(cleaned, location);
  }

  function retry() {
    if (lastSubmitRef.current) runResearch(lastSubmitRef.current.sources, lastSubmitRef.current.location);
  }

  return (
    <div className="max-w-[920px]">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Lead Research</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">
          Paste every public source you have for this business — website, Google Business
          profile, Instagram, Facebook. Nothing is guessed: every field on the profile traces
          back to one of these sources, or is marked not found.
        </div>
      </div>

      {job.mode === "idle" && (
        <form
          onSubmit={handleSubmit}
          className="p-6 rounded-[14px] flex flex-col gap-4 max-w-[640px]"
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">Sources</label>
            {sources.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={s}
                  onChange={(e) => updateSource(i, e.target.value)}
                  placeholder={i === 0 ? "https://example-business.com" : "https://instagram.com/example"}
                  className="flex-1 h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
                  style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                />
                {sources.length > 1 && (
                  <button type="button" onClick={() => removeSource(i)} className="p-2 rounded-[8px] text-[#6E6E73] hover:text-white hover:bg-[#151515]">
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addSource} className="self-start flex items-center gap-1.5 text-[12.5px] text-[#A1A1A6] hover:text-white mt-1">
              <Plus size={13} /> Add another source
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">City, State (optional)</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Austin, TX"
              className="h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>

          {error && <p className="text-[13px] text-[#FF453A]">{error}</p>}

          <button type="submit" className="h-[42px] rounded-[8px] bg-white text-black text-[13.5px] font-semibold flex items-center justify-center gap-2">
            <Search size={15} /> Research Business
          </button>
          <p className="text-[11.5px] text-[#6E6E73] leading-relaxed">
            This runs a real research pass across every source you list — no data is invented.
            Fields we can't confirm are marked as uncertain or not found, and you'll be able to see
            exactly which source backs each field. Research doesn't create a lead — you'll review the
            results first and choose Save as Lead, Research More, or Discard.
          </p>
        </form>
      )}

      {job.mode !== "idle" && (
        <div>
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
  );
}
