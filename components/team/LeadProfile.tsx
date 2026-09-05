"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Globe, MapPin, ChevronDown, ChevronUp, CheckCircle2, HelpCircle, XCircle, AlertTriangle, Gauge, Sparkles, PhoneCall } from "lucide-react";

type Evidence = {
  id: string;
  field_name: string;
  field_value: string | null;
  status: "verified" | "uncertain" | "not_found" | "conflict";
  confidence: number | null;
  source_url: string | null;
  source_type: string | null;
};

type Audit = {
  overall_score: number | null;
  identity_score: number | null;
  knowledge_score: number | null;
  authority_score: number | null;
  location_score: number | null;
  machine_readability_score: number | null;
  summary: string | null;
  strengths: string[];
  middle_points: string[];
  weaknesses: string[];
  unknowns: string[];
} | null;

type Lead = {
  id: string;
  business_name: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  city: string | null;
  state: string | null;
  source_urls: string[];
  pipeline_stage: string;
  recommended_offer: string | null;
};

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "#30D158", label: "Verified" },
  uncertain: { icon: HelpCircle, color: "#FFD60A", label: "Uncertain" },
  not_found: { icon: XCircle, color: "#6E6E73", label: "Not Found" },
  conflict: { icon: AlertTriangle, color: "#FF9F0A", label: "Conflict" },
};

function FieldRow({ label, evidences }: { label: string; evidences: Evidence[] }) {
  const [open, setOpen] = useState(false);
  const primary = evidences[0];
  const meta = STATUS_META[primary?.status || "not_found"];
  const Icon = meta.icon;

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <Icon size={15} style={{ color: meta.color }} />
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73]">{label}</div>
            <div className="text-[13.5px] text-[#F5F5F7]">{primary?.field_value || "Not found"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[#6E6E73]">
          <span className="text-[11.5px]" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-1.5">
          {evidences.length === 0 && <div className="text-[12px] text-[#6E6E73]">No evidence recorded.</div>}
          {evidences.map((e) => (
            <div
              key={e.id}
              className="text-[12px] text-[#A1A1A6] rounded-[8px] px-3 py-2"
              style={{ background: "#101010" }}
            >
              <div className="flex items-center justify-between">
                <span className="capitalize">{e.source_type || "unknown source"}</span>
                <span>{e.confidence != null ? `${Math.round(e.confidence * 100)}% confidence` : ""}</span>
              </div>
              {e.source_url && (
                <a
                  href={e.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-[#0A84FF] mt-0.5"
                >
                  {e.source_url}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SCORE_LABELS: [string, keyof NonNullable<Audit>][] = [
  ["Identity", "identity_score"],
  ["Knowledge", "knowledge_score"],
  ["Authority", "authority_score"],
  ["Location", "location_score"],
  ["Machine Readability", "machine_readability_score"],
];

export default function LeadProfile({
  lead,
  evidence,
  audit,
}: {
  lead: Lead;
  evidence: Evidence[];
  audit: Audit;
}) {
  const [tab, setTab] = useState<"overview" | "research" | "audit">("overview");

  const grouped: Record<string, Evidence[]> = {};
  for (const e of evidence) {
    if (e.field_name === "source_status") continue;
    if (!grouped[e.field_name]) grouped[e.field_name] = [];
    grouped[e.field_name].push(e);
  }

  const fieldLabels: Record<string, string> = {
    business_name: "Business Name",
    phone: "Phone",
    website: "Website",
    category: "Category",
    location: "Location",
  };

  return (
    <div className="px-8 py-8 max-w-[880px]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-[#F5F5F7]">{lead.business_name || "Unnamed lead"}</div>
          <div className="flex items-center gap-4 mt-2 text-[13px] text-[#A1A1A6]">
            {lead.website && (
              <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-white">
                <Globe size={13} /> {lead.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            {lead.phone && (
              <span className="flex items-center gap-1.5">
                <Phone size={13} /> {lead.phone}
              </span>
            )}
            {(lead.city || lead.state) && (
              <span className="flex items-center gap-1.5">
                <MapPin size={13} /> {[lead.city, lead.state].filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        </div>
        {audit?.overall_score != null && (
          <div className="text-right">
            <div className="text-[28px] font-semibold text-[#F5F5F7]">{audit.overall_score}</div>
            <div className="text-[11px] text-[#6E6E73] uppercase tracking-wide">AI Presence Score</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Link
          href={`/team/leads/${lead.id}/audit`}
          className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#A1A1A6] hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <Gauge size={13} /> AI Audit
        </Link>
        <Link
          href={`/team/leads/${lead.id}/script`}
          className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#A1A1A6] hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.10)" }}
        >
          <Sparkles size={13} /> Script
        </Link>
        <Link
          href={`/team/leads/${lead.id}/call`}
          className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold"
        >
          <PhoneCall size={13} /> Call
        </Link>
      </div>

      <div className="flex items-center gap-1 mb-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["overview", "research", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[13px] capitalize"
            style={{
              color: tab === t ? "#F5F5F7" : "#6E6E73",
              borderBottom: tab === t ? "2px solid white" : "2px solid transparent",
            }}
          >
            {t === "audit" ? "AI Audit" : t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[13px] font-semibold text-[#F5F5F7] mb-3">Sources supplied</div>
            <div className="flex flex-col gap-1.5">
              {lead.source_urls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-[#0A84FF] truncate">
                  {u}
                </a>
              ))}
            </div>
          </div>
          {lead.recommended_offer && (
            <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[13px] font-semibold text-[#F5F5F7] mb-1 capitalize">
                Recommended offer: {lead.recommended_offer.replace(/_/g, " ")}
              </div>
              <div className="text-[12.5px] text-[#6E6E73]">Based on the AI Audit tab's scoring breakdown.</div>
            </div>
          )}
        </div>
      )}

      {tab === "research" && (
        <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {Object.keys(fieldLabels).map((f) => (
            <FieldRow key={f} label={fieldLabels[f]} evidences={grouped[f] || []} />
          ))}
        </div>
      )}

      {tab === "audit" && (
        <div className="flex flex-col gap-4">
          {!audit ? (
            <div className="text-[13px] text-[#6E6E73]">No audit has been generated for this lead yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-3">
                {SCORE_LABELS.map(([label, key]) => (
                  <div key={key} className="rounded-[10px] p-3 text-center" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="text-[18px] font-semibold text-[#F5F5F7]">{audit[key] ?? 0}</div>
                    <div className="text-[10px] text-[#6E6E73] uppercase tracking-wide mt-1">{label}</div>
                  </div>
                ))}
              </div>
              {audit.summary && <p className="text-[13.5px] text-[#A1A1A6] leading-relaxed">{audit.summary}</p>}
              {[
                ["Strengths", audit.strengths, "#30D158"],
                ["Needs Work", audit.middle_points, "#FFD60A"],
                ["Weaknesses", audit.weaknesses, "#FF453A"],
                ["Unknown", audit.unknowns, "#6E6E73"],
              ].map(([title, list, color]) =>
                (list as string[]).length > 0 ? (
                  <div key={title as string}>
                    <div className="text-[12px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: color as string }}>
                      {title as string}
                    </div>
                    <ul className="flex flex-col gap-1">
                      {(list as string[]).map((item, i) => (
                        <li key={i} className="text-[13px] text-[#A1A1A6]">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
