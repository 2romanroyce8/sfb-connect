"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Phone, Loader2 } from "lucide-react";

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  category: string | null;
  city: string | null;
  recommended_offer: string | null;
};

type Summary = { narrative: string; strong: string[]; middle: string[]; weak: string[]; unknown: string[] } | null;

type Opportunity = { primary_offer: string; secondary_offer: string | null; confidence: string; reasoning: string } | null;

type Script = {
  id: string;
  variant_type: string;
  opening: string;
  hook: string;
  observation: string;
  why_it_matters: string;
  solution: string;
  discovery_question: string;
  transition: string;
  booking_ask: string;
  objections: { objection: string; response: string }[];
  close: string;
} | null;

const OFFER_LABEL: Record<string, string> = {
  ai_presence: "AI Presence",
  website_new: "New Website",
  website_rebuild: "Website Rebuild",
  bingled: "Bingled",
  no_clear_opportunity: "No Clear Opportunity",
};

const SECTION_ORDER: { key: keyof NonNullable<Script>; label: string }[] = [
  { key: "opening", label: "Opening" },
  { key: "hook", label: "Permission / Hook" },
  { key: "observation", label: "Business-Specific Observation" },
  { key: "why_it_matters", label: "Why It Matters" },
  { key: "discovery_question", label: "Discovery Question" },
  { key: "solution", label: "Offer" },
  { key: "transition", label: "Transition" },
  { key: "booking_ask", label: "Meeting Close" },
  { key: "close", label: "Final Close" },
];

export default function ScriptWorkspace({
  lead,
  hasAudit,
  summary,
  opportunity,
  script: initialScript,
}: {
  lead: Lead;
  hasAudit: boolean;
  summary: Summary;
  opportunity: Opportunity;
  script: Script;
}) {
  const router = useRouter();
  const [script, setScript] = useState(initialScript);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [objectionInput, setObjectionInput] = useState("");
  const [objectionLoading, setObjectionLoading] = useState(false);

  async function generate(variant: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/leads/${lead.id}/script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate script.");
      setScript(data);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function askObjection() {
    if (!objectionInput.trim()) return;
    setObjectionLoading(true);
    try {
      const res = await fetch(`/api/team/leads/${lead.id}/script/objection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectionText: objectionInput, scriptId: script?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (script) setScript({ ...script, objections: [...script.objections, { objection: data.objection, response: data.response }] });
      setObjectionInput("");
    } catch {
      // silent — the input stays so the rep can retry
    } finally {
      setObjectionLoading(false);
    }
  }

  if (!hasAudit) {
    return (
      <div className="px-8 py-8 max-w-[640px]">
        <div className="text-[13.5px] text-[#6E6E73] mb-4">
          Run the AI Presence Audit for this lead before generating a call script — the script is built entirely
          from that audit's evidence.
        </div>
        <Link href={`/team/leads/${lead.id}/audit`} className="h-[38px] px-4 inline-flex items-center rounded-[8px] bg-white text-black text-[13px] font-semibold">
          Go to Audit
        </Link>
      </div>
    );
  }

  return (
    <div className="px-8 py-8">
      <div className="grid grid-cols-[260px_1fr_280px] gap-6">
        {/* LEFT: business summary */}
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[15px] font-semibold text-[#F5F5F7]">{lead.business_name || "Unnamed lead"}</div>
            <div className="text-[12.5px] text-[#6E6E73] mt-0.5">{lead.website?.replace(/^https?:\/\//, "")}</div>
          </div>
          {opportunity && (
            <div className="rounded-[10px] p-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73] mb-1">Recommended Pitch</div>
              <div className="text-[14px] text-[#F5F5F7] font-medium">{OFFER_LABEL[opportunity.primary_offer]}</div>
              <div className="text-[11.5px] text-[#A1A1A6] capitalize mt-0.5">Confidence: {opportunity.confidence}</div>
            </div>
          )}
          {summary && (
            <>
              <p className="text-[12.5px] text-[#A1A1A6] leading-relaxed">{summary.narrative}</p>
              {summary.strong.length > 0 && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-[#30D158] mb-1">Strong</div>
                  {summary.strong.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-[12px] text-[#A1A1A6]">• {s}</div>
                  ))}
                </div>
              )}
              {summary.weak.length > 0 && (
                <div>
                  <div className="text-[10.5px] uppercase tracking-wide text-[#FF453A] mb-1">Weak</div>
                  {summary.weak.slice(0, 3).map((s, i) => (
                    <div key={i} className="text-[12px] text-[#A1A1A6]">• {s}</div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* CENTER: live script */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="text-[16px] font-semibold text-[#F5F5F7]">Call Script</div>
            <div className="flex items-center gap-2">
              {["original", "shorter", "direct", "conversational"].map((v) => (
                <button
                  key={v}
                  onClick={() => generate(v)}
                  disabled={loading}
                  className="h-[30px] px-3 rounded-[7px] text-[11.5px] capitalize text-[#A1A1A6] hover:text-white disabled:opacity-50"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : v}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-[13px] text-[#FF453A] mb-3">{error}</p>}

          {!script ? (
            <button
              onClick={() => generate("original")}
              disabled={loading}
              className="h-[42px] px-4 inline-flex items-center gap-2 rounded-[8px] bg-white text-black text-[13.5px] font-semibold disabled:opacity-60"
            >
              <Sparkles size={15} /> Generate Script
            </button>
          ) : (
            <div className="rounded-[14px] p-6 flex flex-col gap-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              {SECTION_ORDER.map(({ key, label }) => (
                <div key={key}>
                  <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-1">{label}</div>
                  <p className="text-[14.5px] text-[#F5F5F7] leading-relaxed">{script[key] as string}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: objections + call action */}
        <div className="flex flex-col gap-4">
          <Link
            href={`/team/leads/${lead.id}/call`}
            className="h-[42px] inline-flex items-center justify-center gap-2 rounded-[8px] bg-white text-black text-[13.5px] font-semibold"
          >
            <Phone size={15} /> Start Call
          </Link>

          {script && (
            <div className="rounded-[12px] p-4 flex flex-col gap-3" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73]">Objection Handling</div>
              {script.objections.map((o, i) => (
                <div key={i} className="text-[12.5px]">
                  <div className="text-[#A1A1A6] italic">"{o.objection}"</div>
                  <div className="text-[#F5F5F7] mt-1 leading-snug">{o.response}</div>
                </div>
              ))}
              <div className="flex flex-col gap-1.5 mt-1">
                <input
                  value={objectionInput}
                  onChange={(e) => setObjectionInput(e.target.value)}
                  placeholder="What did they say?"
                  className="h-[34px] rounded-[7px] px-2.5 text-[12.5px] outline-none"
                  style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                />
                <button
                  onClick={askObjection}
                  disabled={objectionLoading}
                  className="h-[32px] rounded-[7px] text-[12px] text-[#A1A1A6] hover:text-white disabled:opacity-50"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {objectionLoading ? "Generating…" : "Generate Response"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
