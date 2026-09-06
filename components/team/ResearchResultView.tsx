"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, HelpCircle, XCircle, AlertTriangle, Loader2, Save, Trash2, RefreshCw, Pencil, Plus } from "lucide-react";
import type { BusinessGraph } from "@/lib/research/types";

type Result = {
  id: string;
  source_urls: string[];
  business_name: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  category: string | null;
  description: string | null;
  services: string[];
  owner_name: string | null;
  city: string | null;
  state: string | null;
  research_completeness: number | null;
  research_completeness_breakdown: { category: string; percent: number }[] | null;
  graph_json: BusinessGraph;
  status: "pending" | "saved" | "discarded";
  converted_lead_id: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { icon: React.ElementType; color: string }> = {
  verified: { icon: CheckCircle2, color: "#30D158" },
  uncertain: { icon: HelpCircle, color: "#FFD60A" },
  not_found: { icon: XCircle, color: "#FF453A" },
  conflict: { icon: AlertTriangle, color: "#FF9F0A" },
};

const EDIT_FIELDS: { key: keyof Result; label: string }[] = [
  { key: "business_name", label: "Business Name" },
  { key: "website", label: "Website" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "category", label: "Category" },
  { key: "owner_name", label: "Owner / Contact" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
];

export default function ResearchResultView({ result: initialResult, reps }: { result: Result; reps: { id: string; label: string }[] }) {
  const router = useRouter();
  const [result, setResult] = useState(initialResult);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(EDIT_FIELDS.map((f) => [f.key, (result[f.key] as string) || ""]))
  );
  const [saving, setSaving] = useState(false);
  const [assignedRep, setAssignedRep] = useState(reps[0]?.id || "");
  const [showMore, setShowMore] = useState(false);
  const [moreSource, setMoreSource] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveEdits() {
    setSaving(true);
    try {
      await fetch(`/api/team/research/${result.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setResult({ ...result, ...form } as Result);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveAsLead() {
    setBusy("save");
    setError(null);
    try {
      const res = await fetch(`/api/team/research/${result.id}/save-as-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedRep }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/team/leads/${data.leadId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save as lead.");
      setBusy(null);
    }
  }

  async function discard() {
    setBusy("discard");
    try {
      await fetch(`/api/team/research/${result.id}/discard`, { method: "POST" });
      router.push("/team/research");
    } finally {
      setBusy(null);
    }
  }

  async function researchMore() {
    setBusy("more");
    setError(null);
    try {
      const res = await fetch(`/api/team/research/${result.id}/research-more`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalSources: moreSource ? [moreSource] : [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMoreSource("");
      setShowMore(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not research more.");
    } finally {
      setBusy(null);
    }
  }

  const graph = result.graph_json;
  const primary = graph.locations?.find((l) => l.locationType === "primary");
  const serviceAreas = graph.locations?.filter((l) => l.locationType === "service_area") || [];

  return (
    <div className="px-8 py-8 max-w-[820px]">
      {result.status !== "pending" && (
        <div className="mb-5 rounded-[10px] p-3 text-[13px]" style={{ background: result.status === "saved" ? "rgba(48,209,88,0.08)" : "rgba(110,110,115,0.1)", color: result.status === "saved" ? "#30D158" : "#A1A1A6" }}>
          {result.status === "saved" ? (
            <>
              Already saved as a lead.{" "}
              <Link href={`/team/leads/${result.converted_lead_id}`} className="underline">
                View lead →
              </Link>
            </>
          ) : (
            "This research was discarded."
          )}
        </div>
      )}

      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#6E6E73]">Research Results</div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[22px] font-semibold text-[#F5F5F7]">{result.business_name || "Unidentified business"}</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">Not yet a lead — review before saving.</div>
        </div>
        {result.research_completeness != null && (
          <div className="text-right">
            <div className="text-[24px] font-semibold text-[#F5F5F7]">{result.research_completeness}%</div>
            <div className="text-[11px] text-[#6E6E73] uppercase tracking-wide">Research Complete</div>
          </div>
        )}
      </div>

      {error && <p className="text-[13px] text-[#FF453A] mb-4">{error}</p>}

      {/* Summary / Edit */}
      <div className="rounded-[12px] p-5 mb-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-semibold text-[#F5F5F7]">Business Summary</div>
          {!editing && result.status === "pending" && (
            <button onClick={() => setEditing(true)} className="text-[12px] text-[#6E6E73] hover:text-white flex items-center gap-1">
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{f.label}</label>
                  <input
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full h-[34px] rounded-[7px] px-2.5 text-[12.5px] outline-none mt-1"
                    style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdits} disabled={saving} className="h-[32px] px-3 rounded-[7px] bg-white text-black text-[12px] font-semibold disabled:opacity-60">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} className="h-[32px] px-3 rounded-[7px] text-[12px] text-[#A1A1A6]" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            {EDIT_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{f.label}</div>
                <div className="text-[#F5F5F7] mt-0.5">{(result[f.key] as string) || "Not found"}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Locations */}
      <Section title="Locations">
        <Row label="Primary" value={primary ? [primary.address, primary.city, primary.state].filter(Boolean).join(", ") : null} status={primary?.status} />
        {serviceAreas.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Service Areas ({serviceAreas.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {serviceAreas.map((l, i) => (
                <span key={i} className="px-2.5 py-1 rounded-[6px] text-[12px] text-[#A1A1A6]" style={{ background: "#101010" }}>
                  {l.city || l.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* Social */}
      <Section title="Social Profiles">
        {(["facebook", "instagram", "tiktok", "linkedin", "youtube", "x", "whatsapp"] as const).map((platform) => {
          const row = graph.socialProfiles?.find((s) => s.platform === platform);
          return <Row key={platform} label={platform} value={row?.url || row?.handle || null} status={row?.status} />;
        })}
      </Section>

      {/* Sources checked */}
      <Section title="Sources Checked">
        {(graph.sourceChecks || []).map((c, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <div className="text-[12.5px] text-[#F5F5F7] truncate">{c.sourceUrl}</div>
            <span className="text-[11.5px] shrink-0 ml-3" style={{ color: c.reachable ? "#30D158" : "#6E6E73" }}>
              {c.reachable ? "Checked" : `Source Unavailable${c.reason ? ` — ${c.reason}` : ""}`}
            </span>
          </div>
        ))}
      </Section>

      {result.status === "pending" && (
        <div className="flex flex-wrap items-center gap-2 mt-6">
          {reps.length > 1 && (
            <select
              value={assignedRep}
              onChange={(e) => setAssignedRep(e.target.value)}
              className="h-[40px] rounded-[8px] px-3 text-[13px] outline-none"
              style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            >
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          <button onClick={saveAsLead} disabled={!!busy} className="h-[40px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60">
            {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save as Lead
          </button>
          <button onClick={() => setShowMore((v) => !v)} disabled={!!busy} className="h-[40px] px-4 inline-flex items-center gap-1.5 rounded-[8px] text-[13px] text-[#A1A1A6] hover:text-white" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <RefreshCw size={14} /> Research More
          </button>
          <button onClick={discard} disabled={!!busy} className="h-[40px] px-4 inline-flex items-center gap-1.5 rounded-[8px] text-[13px] text-[#FF453A]" style={{ border: "1px solid rgba(255,69,58,0.3)" }}>
            {busy === "discard" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Discard
          </button>
        </div>
      )}

      {showMore && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={moreSource}
            onChange={(e) => setMoreSource(e.target.value)}
            placeholder="Add another source URL"
            className="h-[38px] w-[320px] rounded-[8px] px-3 text-[13px] outline-none"
            style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
          />
          <button onClick={researchMore} disabled={!!busy} className="h-[38px] px-3.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold flex items-center gap-1.5">
            {busy === "more" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Research
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">{title}</div>
      <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, status }: { label: string; value: string | null; status?: string }) {
  const meta = STATUS_META[status || "not_found"];
  const Icon = meta.icon;
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2.5">
        <Icon size={14} style={{ color: meta.color }} />
        <span className="text-[11px] uppercase tracking-wide text-[#6E6E73] capitalize">{label}</span>
      </div>
      <span className="text-[13px] text-[#F5F5F7] truncate max-w-[400px]">{value || "Not found"}</span>
    </div>
  );
}
