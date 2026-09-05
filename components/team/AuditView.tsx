"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RefreshCw, ArrowRight } from "lucide-react";

type Category = {
  category: string;
  score: number;
  reason: string;
  positive_evidence: string[];
  negative_evidence: string[];
  unknowns: string[];
  recommended_fixes: string[];
};

type Audit = {
  id: string;
  overall_score: number;
  created_at: string;
} | null;

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
};

const CATEGORY_LABEL: Record<string, string> = {
  identity: "Identity",
  knowledge: "Knowledge",
  authority: "Authority",
  location: "Location",
  machine_readability: "Machine Readability",
};

function ScoreDial({ score }: { score: number }) {
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? "#30D158" : score >= 40 ? "#FFD60A" : "#FF453A";

  return (
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r={radius} fill="none" stroke="#151515" strokeWidth="14" />
      <circle
        cx="100"
        cy="100"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 100 100)"
      />
      <text x="100" y="94" textAnchor="middle" fontSize="42" fontWeight="700" fill="#F5F5F7">
        {score}
      </text>
      <text x="100" y="120" textAnchor="middle" fontSize="12" fill="#6E6E73" letterSpacing="1">
        / 100
      </text>
    </svg>
  );
}

export default function AuditView({ lead, audit, categories }: { lead: Lead; audit: Audit; categories: Category[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/leads/${lead.id}/audit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate audit.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (!audit) {
    return (
      <div className="px-8 py-8 max-w-[700px]">
        <div className="text-[13.5px] text-[#6E6E73] mb-4">
          No research evidence is on file for this lead yet, so an audit can't be generated. Run the lead
          researcher first.
        </div>
        {error && <p className="text-[13px] text-[#FF453A] mb-3">{error}</p>}
        <button
          onClick={regenerate}
          disabled={loading}
          className="h-[40px] px-4 rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60"
        >
          {loading ? "Checking…" : "Try Again"}
        </button>
      </div>
    );
  }

  const understands = categories.flatMap((c) => c.positive_evidence);
  const struggles = categories.flatMap((c) => c.negative_evidence);
  const unverified = categories.flatMap((c) => c.unknowns);
  const fixes = categories.flatMap((c) => c.recommended_fixes);

  return (
    <div className="px-8 py-8 max-w-[900px]">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6E6E73]">The Diagnostic</div>
      <div className="text-[24px] font-semibold text-[#F5F5F7] mb-1">Your AI Presence Score.</div>
      <div className="flex items-center gap-3 text-[13px] text-[#A1A1A6] mb-8">
        <span>{lead.business_name || "Unnamed lead"}</span>
        {lead.website && (
          <>
            <span className="text-[#3A3A3C]">·</span>
            <span>{lead.website.replace(/^https?:\/\//, "")}</span>
          </>
        )}
        <span className="text-[#3A3A3C]">·</span>
        <span>Last verified {new Date(audit.created_at).toLocaleDateString()}</span>
      </div>

      <div className="grid grid-cols-[220px_1fr] gap-10 mb-10">
        <div className="flex items-center justify-center">
          <ScoreDial score={audit.overall_score} />
        </div>
        <div className="flex flex-col gap-4 justify-center">
          {categories.map((c) => (
            <div key={c.category}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[13px] text-[#F5F5F7]">{CATEGORY_LABEL[c.category] || c.category}</span>
                <span className="text-[12.5px] text-[#A1A1A6]">{c.score}/20</span>
              </div>
              <div className="h-[6px] rounded-full overflow-hidden" style={{ background: "#151515" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(c.score / 20) * 100}%`,
                    background: c.score >= 15 ? "#30D158" : c.score >= 8 ? "#FFD60A" : "#FF453A",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <Panel title="AI Understands" items={understands} color="#30D158" />
        <Panel title="AI May Struggle With" items={struggles} color="#FFD60A" />
        <Panel title="Unable To Verify" items={unverified} color="#6E6E73" />
        <Panel title="Recommended Improvements" items={fixes} color="#0A84FF" />
      </div>

      {error && <p className="text-[13px] text-[#FF453A] mb-3">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          onClick={regenerate}
          disabled={loading}
          className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] text-[13px] text-[#A1A1A6] hover:text-white disabled:opacity-60"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> {loading ? "Regenerating…" : "Regenerate Audit"}
        </button>
        <Link
          href={`/team/leads/${lead.id}/script`}
          className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
        >
          Build Call Script <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

function Panel({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div className="rounded-[12px] p-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color }}>
        {title}
      </div>
      {items.length === 0 ? (
        <div className="text-[12.5px] text-[#6E6E73]">Nothing here.</div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="text-[12.5px] text-[#A1A1A6] leading-snug">
              • {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
