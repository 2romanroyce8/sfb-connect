"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  Globe,
  MapPin,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  XCircle,
  AlertTriangle,
  Gauge,
  Sparkles,
  PhoneCall,
  Pencil,
  RefreshCw,
} from "lucide-react";
import LeadActions from "./LeadActions";

type StatusValue = "verified" | "uncertain" | "not_found" | "conflict";

type ContactMethod = { id: string; type: string; value: string | null; status: StatusValue; confidence: number | null; source_url: string | null; manual_value: string | null; edited_at: string | null };
type LocationRow = { id: string; name: string | null; address: string | null; city: string | null; state: string | null; postal_code: string | null; location_type: string; status: StatusValue; confidence: number | null; source_url: string | null; manual_value: string | null; edited_at: string | null };
type SocialRow = { id: string; platform: string; handle: string | null; url: string | null; display_name: string | null; status: StatusValue; confidence: number | null; source_url: string | null; manual_value: string | null; edited_at: string | null };
type SourceCheck = { source_url: string; source_type: string; reachable: boolean; reason: string | null; checked_at: string };

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
  description: string | null;
  services: string[];
  owner_name: string | null;
  city: string | null;
  state: string | null;
  source_urls: string[];
  pipeline_stage: string;
  recommended_offer: string | null;
  research_completeness: number | null;
  research_completeness_breakdown: { category: string; percent: number }[] | null;
  last_researched_at: string | null;
  archived: boolean;
  assigned_rep: string | null;
};

const STATUS_META: Record<StatusValue, { icon: React.ElementType; color: string; label: string }> = {
  verified: { icon: CheckCircle2, color: "#30D158", label: "Verified" },
  uncertain: { icon: HelpCircle, color: "#FFD60A", label: "Uncertain" },
  not_found: { icon: XCircle, color: "#FF453A", label: "Not Found" },
  conflict: { icon: AlertTriangle, color: "#FF9F0A", label: "Conflict" },
};

const CONTACT_LABEL: Record<string, string> = { phone: "Phone", email: "Email", website: "Website", whatsapp: "WhatsApp", booking: "Booking", contact_form: "Contact Form" };
const SOCIAL_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn", youtube: "YouTube", x: "X", whatsapp: "WhatsApp" };
const LOCATION_LABEL: Record<string, string> = { primary: "Primary", branch: "Branch", service_area: "Service Area", tagged_location: "Tagged", mentioned_location: "Mentioned", uncertain: "Uncertain" };

function EditableField({
  leadId,
  table,
  rowId,
  currentValue,
  manualValue,
}: {
  leadId: string;
  table: "contact" | "location" | "social";
  rowId: string;
  currentValue: string | null;
  manualValue: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(manualValue || currentValue || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/team/leads/${leadId}/manual-correction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, rowId, manualValue: value }),
      });
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-[28px] rounded-[6px] px-2 text-[12.5px] outline-none"
          style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
        />
        <button onClick={save} disabled={saving} className="text-[11.5px] text-[#30D158]">
          Save
        </button>
        <button onClick={() => setEditing(false)} className="text-[11.5px] text-[#6E6E73]">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-[#6E6E73] hover:text-white">
      <Pencil size={12} />
    </button>
  );
}

function FieldRow({
  leadId,
  table,
  label,
  value,
  manualValue,
  status,
  confidence,
  sourceUrl,
  rowId,
  sourceChecks,
}: {
  leadId: string;
  table: "contact" | "location" | "social";
  label: string;
  value: string | null;
  manualValue: string | null;
  status: StatusValue;
  confidence: number | null;
  sourceUrl: string | null;
  rowId: string;
  sourceChecks: SourceCheck[];
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const displayValue = manualValue || value;

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-full flex items-center justify-between px-4 py-3">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <Icon size={15} style={{ color: meta.color }} className="shrink-0" />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73]">{label}</div>
            <div className="text-[13.5px] text-[#F5F5F7] truncate">{displayValue || "Not found"}</div>
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {manualValue && <span className="text-[10px] text-[#0A84FF] uppercase tracking-wide">Manually Verified</span>}
          <span className="text-[11.5px]" style={{ color: meta.color }}>
            {meta.label}
          </span>
          <EditableField leadId={leadId} table={table} rowId={rowId} currentValue={value} manualValue={manualValue} />
          <button onClick={() => setOpen((v) => !v)} className="text-[#6E6E73]">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {sourceUrl && (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#0A84FF] truncate block">
              {sourceUrl}
            </a>
          )}
          {confidence != null && <div className="text-[11.5px] text-[#6E6E73]">{Math.round(confidence * 100)}% confidence</div>}
          <div className="rounded-[8px] px-3 py-2" style={{ background: "#101010" }}>
            <div className="text-[10.5px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Research Attempted</div>
            <div className="flex flex-col gap-1">
              {sourceChecks.length === 0 && <div className="text-[11.5px] text-[#6E6E73]">No sources checked.</div>}
              {sourceChecks.map((c, i) => (
                <div key={i} className="text-[11.5px] flex items-center gap-1.5" style={{ color: c.reachable ? "#A1A1A6" : "#6E6E73" }}>
                  {c.reachable ? <CheckCircle2 size={11} className="text-[#30D158]" /> : <XCircle size={11} className="text-[#6E6E73]" />}
                  <span className="capitalize">{c.source_type.replace(/_/g, " ")}</span>
                  {!c.reachable && <span className="italic">— source unavailable{c.reason ? ` (${c.reason})` : ""}</span>}
                </div>
              ))}
            </div>
          </div>
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
  contactMethods,
  locations,
  socialProfiles,
  sourceChecks,
  audit,
  isOwner,
  reps,
}: {
  lead: Lead;
  contactMethods: ContactMethod[];
  locations: LocationRow[];
  socialProfiles: SocialRow[];
  sourceChecks: SourceCheck[];
  audit: Audit;
  isOwner: boolean;
  reps: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"overview" | "contact" | "locations" | "social" | "business" | "research" | "audit">("overview");
  const [researching, setResearching] = useState<string | null>(null);

  async function researchAgain(scope: string) {
    setResearching(scope);
    try {
      await fetch(`/api/team/leads/${lead.id}/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      router.refresh();
    } finally {
      setResearching(null);
    }
  }

  const primary = locations.find((l) => l.location_type === "primary");
  const serviceAreas = locations.filter((l) => l.location_type === "service_area");

  return (
    <div className="px-8 py-8 max-w-[920px]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[22px] font-semibold text-[#F5F5F7]">{lead.business_name || "Unnamed lead"}</div>
            {lead.archived && <span className="text-[10.5px] uppercase tracking-wide text-[#6E6E73] px-2 py-0.5 rounded-[5px]" style={{ border: "1px solid rgba(255,255,255,0.15)" }}>Archived</span>}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[13px] text-[#A1A1A6] flex-wrap">
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
        {lead.research_completeness != null && (
          <div className="text-right">
            <div className="text-[24px] font-semibold text-[#F5F5F7]">{lead.research_completeness}%</div>
            <div className="text-[11px] text-[#6E6E73] uppercase tracking-wide">Research Complete</div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Link href={`/team/leads/${lead.id}/audit`} className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#A1A1A6] hover:text-white" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
          <Gauge size={13} /> AI Audit
        </Link>
        <Link href={`/team/leads/${lead.id}/script`} className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#A1A1A6] hover:text-white" style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
          <Sparkles size={13} /> Script
        </Link>
        <Link href={`/team/leads/${lead.id}/call`} className="h-[36px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">
          <PhoneCall size={13} /> Call
        </Link>
        <div className="flex-1" />
        <LeadActions leadId={lead.id} archived={lead.archived} isOwner={isOwner} reps={reps} currentAssignedRep={lead.assigned_rep} />
      </div>

      <div className="flex items-center gap-1 mb-6 overflow-x-auto" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["overview", "contact", "locations", "social", "business", "research", "audit"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2.5 text-[13px] capitalize whitespace-nowrap"
            style={{ color: tab === t ? "#F5F5F7" : "#6E6E73", borderBottom: tab === t ? "2px solid white" : "2px solid transparent" }}
          >
            {t === "audit" ? "AI Audit" : t === "social" ? "Social Profiles" : t}
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
          {lead.research_completeness_breakdown && (
            <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[13px] font-semibold text-[#F5F5F7] mb-3">Research Completeness</div>
              <div className="flex flex-col gap-2">
                {lead.research_completeness_breakdown.map((b) => (
                  <div key={b.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12.5px] text-[#A1A1A6]">{b.category}</span>
                      <span className="text-[12px] text-[#6E6E73]">{b.percent}%</span>
                    </div>
                    <div className="h-[5px] rounded-full overflow-hidden" style={{ background: "#151515" }}>
                      <div className="h-full rounded-full" style={{ width: `${b.percent}%`, background: b.percent >= 80 ? "#30D158" : b.percent >= 40 ? "#FFD60A" : "#FF453A" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {lead.recommended_offer && (
            <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[13px] font-semibold text-[#F5F5F7] mb-1 capitalize">Recommended offer: {lead.recommended_offer.replace(/_/g, " ")}</div>
              <div className="text-[12.5px] text-[#6E6E73]">Based on the AI Audit tab's scoring breakdown.</div>
            </div>
          )}
        </div>
      )}

      {tab === "contact" && (
        <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {contactMethods.length === 0 ? (
            <div className="p-4 text-[13px] text-[#6E6E73]">No contact methods researched yet.</div>
          ) : (
            contactMethods.map((c) => (
              <FieldRow
                key={c.id}
                leadId={lead.id}
                table="contact"
                label={CONTACT_LABEL[c.type] || c.type}
                value={c.value}
                manualValue={c.manual_value}
                status={c.status}
                confidence={c.confidence}
                sourceUrl={c.source_url}
                rowId={c.id}
                sourceChecks={sourceChecks}
              />
            ))
          )}
        </div>
      )}

      {tab === "locations" && (
        <div className="flex flex-col gap-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Primary</div>
            <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              {primary ? (
                <FieldRow
                  leadId={lead.id}
                  table="location"
                  label="Primary Location"
                  value={primary.manual_value || [primary.address, primary.city, primary.state].filter(Boolean).join(", ") || null}
                  manualValue={null}
                  status={primary.status}
                  confidence={primary.confidence}
                  sourceUrl={primary.source_url}
                  rowId={primary.id}
                  sourceChecks={sourceChecks}
                />
              ) : (
                <div className="p-4 text-[13px] text-[#6E6E73]">No primary address found.</div>
              )}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Service Areas ({serviceAreas.length})</div>
            <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              {serviceAreas.length === 0 ? (
                <div className="p-4 text-[13px] text-[#6E6E73]">No service areas found.</div>
              ) : (
                serviceAreas.map((l) => (
                  <FieldRow
                    key={l.id}
                    leadId={lead.id}
                    table="location"
                    label={LOCATION_LABEL[l.location_type]}
                    value={l.manual_value || l.city || l.name}
                    manualValue={null}
                    status={l.status}
                    confidence={l.confidence}
                    sourceUrl={l.source_url}
                    rowId={l.id}
                    sourceChecks={sourceChecks}
                  />
                ))
              )}
            </div>
          </div>
          {locations.filter((l) => !["primary", "service_area"].includes(l.location_type)).length > 0 && (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Other Locations</div>
              <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
                {locations
                  .filter((l) => !["primary", "service_area"].includes(l.location_type))
                  .map((l) => (
                    <FieldRow
                      key={l.id}
                      leadId={lead.id}
                      table="location"
                      label={LOCATION_LABEL[l.location_type]}
                      value={l.manual_value || l.city || l.name}
                      manualValue={null}
                      status={l.status}
                      confidence={l.confidence}
                      sourceUrl={l.source_url}
                      rowId={l.id}
                      sourceChecks={sourceChecks}
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "social" && (
        <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["facebook", "instagram", "tiktok", "linkedin", "youtube", "x", "whatsapp"] as const).map((platform) => {
            const row = socialProfiles.find((s) => s.platform === platform);
            return (
              <FieldRow
                key={platform}
                leadId={lead.id}
                table="social"
                label={SOCIAL_LABEL[platform]}
                value={row ? row.url || row.handle : null}
                manualValue={row?.manual_value || null}
                status={row?.status || "not_found"}
                confidence={row?.confidence ?? null}
                sourceUrl={row?.source_url || null}
                rowId={row?.id || platform}
                sourceChecks={sourceChecks}
              />
            );
          })}
        </div>
      )}

      {tab === "business" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Category</div>
                <div className="text-[13.5px] text-[#F5F5F7] mt-0.5">{lead.category || "Not found"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-[#6E6E73]">Owner / Contact</div>
                <div className="text-[13.5px] text-[#F5F5F7] mt-0.5">{lead.owner_name || "Not found"}</div>
              </div>
            </div>
          </div>
          {lead.description && (
            <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Description</div>
              <p className="text-[13.5px] text-[#A1A1A6] leading-relaxed">{lead.description}</p>
            </div>
          )}
          <div className="rounded-[12px] p-5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="text-[11px] uppercase tracking-wide text-[#6E6E73] mb-1.5">Services</div>
            {lead.services.length === 0 ? (
              <div className="text-[13px] text-[#6E6E73]">Not found</div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {lead.services.map((s) => (
                  <span key={s} className="px-2.5 py-1 rounded-[6px] text-[12px] text-[#A1A1A6]" style={{ background: "#101010" }}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "research" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="text-[13px] text-[#A1A1A6]">
              {lead.last_researched_at ? `Last researched ${new Date(lead.last_researched_at).toLocaleString()}` : "Not yet researched"}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Research Again</div>
            <div className="flex flex-wrap gap-2">
              {[
                ["full", "Full Refresh"],
                ["contact", "Contact Only"],
                ["locations", "Locations Only"],
                ["social", "Social Profiles Only"],
                ["website", "Website Only"],
              ].map(([scope, label]) => (
                <button
                  key={scope}
                  onClick={() => researchAgain(scope)}
                  disabled={!!researching}
                  className="h-[34px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#A1A1A6] hover:text-white disabled:opacity-50"
                  style={{ border: "1px solid rgba(255,255,255,0.10)" }}
                >
                  {researching === scope ? <RefreshCw size={12} className="animate-spin" /> : null} {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-2">Sources Checked</div>
            <div className="rounded-[12px] overflow-hidden" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              {sourceChecks.length === 0 ? (
                <div className="p-4 text-[13px] text-[#6E6E73]">No sources checked yet.</div>
              ) : (
                sourceChecks.map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                    <div className="min-w-0">
                      <div className="text-[12.5px] text-[#F5F5F7] truncate">{c.source_url}</div>
                      <div className="text-[11px] text-[#6E6E73] capitalize">{c.source_type.replace(/_/g, " ")}</div>
                    </div>
                    <span className="text-[11.5px] shrink-0 ml-3" style={{ color: c.reachable ? "#30D158" : "#6E6E73" }}>
                      {c.reachable ? "Checked" : `Source Unavailable${c.reason ? ` — ${c.reason}` : ""}`}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
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
