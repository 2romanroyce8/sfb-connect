"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Search } from "lucide-react";

export default function LeadImportForm({ reps }: { reps: { id: string; label: string }[] }) {
  const router = useRouter();
  const [sources, setSources] = useState<string[]>([""]);
  const [location, setLocation] = useState("");
  const [assignedRep, setAssignedRep] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  function updateSource(i: number, value: string) {
    setSources((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  }

  function addSource() {
    setSources((prev) => [...prev, ""]);
  }

  function removeSource(i: number) {
    setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = sources.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setError("Add at least one source — a website, Google Business profile, or social page.");
      return;
    }
    setLoading(true);
    setError(null);
    setStep("Fetching sources and cross-checking evidence…");
    try {
      const res = await fetch("/api/team/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: cleaned, location, assignedRep: assignedRep || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed.");
      router.push(`/team/leads/${data.leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
      setStep(null);
    }
  }

  return (
    <div className="max-w-[640px]">
      <div className="mb-6">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Lead Research</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">
          Paste every public source you have for this business — website, Google Business
          profile, Instagram, Facebook. Nothing is guessed: every field on the profile traces
          back to one of these sources, or is marked not found.
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-6 rounded-[14px] flex flex-col gap-4"
        style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
            Sources
          </label>
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
                <button
                  type="button"
                  onClick={() => removeSource(i)}
                  className="p-2 rounded-[8px] text-[#6E6E73] hover:text-white hover:bg-[#151515]"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addSource}
            className="self-start flex items-center gap-1.5 text-[12.5px] text-[#A1A1A6] hover:text-white mt-1"
          >
            <Plus size={13} /> Add another source
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
              City, State (optional)
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Austin, TX"
              className="h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">
              Assign to
            </label>
            <select
              value={assignedRep}
              onChange={(e) => setAssignedRep(e.target.value)}
              className="h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            >
              <option value="">Unassigned</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <p className="text-[13px] text-[#FF453A]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="h-[42px] rounded-[8px] bg-white text-black text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {loading ? (
            <>
              <Loader2 size={15} className="animate-spin" /> {step || "Researching…"}
            </>
          ) : (
            <>
              <Search size={15} /> Research Business
            </>
          )}
        </button>
        <p className="text-[11.5px] text-[#6E6E73] leading-relaxed">
          This runs a real research pass across every source you list — no data is invented.
          Fields we can't confirm are marked as uncertain or not found, and you'll be able to see
          exactly which source backs each field on the lead's profile.
        </p>
      </form>
    </div>
  );
}
