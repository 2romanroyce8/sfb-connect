"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Star,
  ArrowUp,
  ArrowDown,
  X,
  Loader2,
  ExternalLink,
  Upload,
  ImageOff,
} from "lucide-react";

type Project = {
  id: string;
  slug: string;
  business_name: string;
  industry: string | null;
  location: string | null;
  year: number | null;
  project_type: string;
  short_description: string | null;
  case_study: { client?: string; challenge?: string; approach?: string; build?: string; delivered?: string; aiPresence?: string };
  website_url: string | null;
  cover_image_url: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
};
type Service = { id: string; project_id: string; service: string };
type Media = { id: string; project_id: string; type: string; url: string; alt_text: string | null };

const PROJECT_TYPES = ["NEW_BUILD", "WEBSITE_REBUILD", "E_COMMERCE", "LANDING_PAGE", "CUSTOM_DEVELOPMENT", "AI_PRESENCE_WEBSITE"];

export default function PortfolioAdmin({
  initialProjects,
  initialServices,
  initialMedia,
}: {
  initialProjects: Project[];
  initialServices: Service[];
  initialMedia: Media[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [services, setServices] = useState(initialServices);
  const [media, setMedia] = useState(initialMedia);
  const [editing, setEditing] = useState<Project | "new" | null>(null);

  async function refresh() {
    const res = await fetch("/api/team/portfolio");
    const data = await res.json();
    setProjects(data.projects || []);
  }

  async function toggleField(p: Project, field: "published" | "featured") {
    const next = !p[field];
    setProjects((prev) => prev.map((x) => (x.id === p.id ? { ...x, [field]: next } : x)));
    await fetch(`/api/team/portfolio/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: next }) });
  }

  async function move(p: Project, direction: -1 | 1) {
    const sorted = [...projects].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((x) => x.id === p.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    const order = [
      { id: a.id, sortOrder: b.sort_order },
      { id: b.id, sortOrder: a.sort_order },
    ];
    setProjects((prev) => prev.map((x) => (x.id === a.id ? { ...x, sort_order: b.sort_order } : x.id === b.id ? { ...x, sort_order: a.sort_order } : x)));
    await fetch("/api/team/portfolio/reorder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order }) });
  }

  async function deleteProject(p: Project) {
    if (!confirm(`Delete "${p.business_name}"? This removes all its media and results too.`)) return;
    await fetch(`/api/team/portfolio/${p.id}`, { method: "DELETE" });
    setProjects((prev) => prev.filter((x) => x.id !== p.id));
  }

  const sorted = [...projects].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-semibold text-[#F5F5F7]">Portfolio</div>
          <div className="text-[13px] text-[#6E6E73] mt-1">
            {projects.length} project{projects.length === 1 ? "" : "s"} — {projects.filter((p) => p.published).length} published
          </div>
        </div>
        <button
          onClick={() => setEditing("new")}
          className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold"
        >
          <Plus size={14} /> Add Project
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[14px] p-10 text-center max-w-[480px]" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="text-[15px] font-medium text-[#F5F5F7] mb-1.5">No portfolio projects yet</div>
          <p className="text-[13px] text-[#A1A1A6]">Add your first real client project — the public /portfolio page and homepage stay empty until you do.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 rounded-[12px] p-3.5" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="w-[64px] h-[48px] rounded-[7px] overflow-hidden shrink-0 flex items-center justify-center" style={{ background: "#151515" }}>
                {p.cover_image_url ? <img src={p.cover_image_url} alt="" className="w-full h-full object-cover" /> : <ImageOff size={16} className="text-[#3A3A3A]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-medium text-[#F5F5F7] truncate">{p.business_name}</span>
                  {p.featured && <Star size={12} className="text-[#FFD60A] fill-[#FFD60A] shrink-0" />}
                </div>
                <div className="text-[12px] text-[#6E6E73] mt-0.5">{p.project_type.replace(/_/g, " ")} · {[p.industry, p.location].filter(Boolean).join(" · ") || "—"}</div>
              </div>
              <span
                className="text-[10.5px] px-2 py-1 rounded-full shrink-0"
                style={{ background: p.published ? "rgba(48,209,88,0.1)" : "rgba(110,110,115,0.12)", color: p.published ? "#30D158" : "#A1A1A6" }}
              >
                {p.published ? "Published" : "Draft"}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <IconBtn onClick={() => move(p, -1)} disabled={i === 0} title="Move up">
                  <ArrowUp size={13} />
                </IconBtn>
                <IconBtn onClick={() => move(p, 1)} disabled={i === sorted.length - 1} title="Move down">
                  <ArrowDown size={13} />
                </IconBtn>
                <IconBtn onClick={() => toggleField(p, "featured")} title={p.featured ? "Unfeature" : "Feature"}>
                  <Star size={13} className={p.featured ? "fill-current" : ""} />
                </IconBtn>
                <IconBtn onClick={() => toggleField(p, "published")} title={p.published ? "Unpublish" : "Publish"}>
                  {p.published ? <EyeOff size={13} /> : <Eye size={13} />}
                </IconBtn>
                <Link href={`/portfolio/${p.slug}`} target="_blank" className="p-1.5 rounded-[6px] text-[#6E6E73] hover:text-white hover:bg-[#151515]" title="Preview">
                  <ExternalLink size={13} />
                </Link>
                <IconBtn onClick={() => setEditing(p)} title="Edit">
                  <Pencil size={13} />
                </IconBtn>
                <IconBtn onClick={() => deleteProject(p)} title="Delete" danger>
                  <Trash2 size={13} />
                </IconBtn>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProjectDrawer
          project={editing === "new" ? null : editing}
          services={editing === "new" ? [] : services.filter((s) => s.project_id === editing.id)}
          media={editing === "new" ? [] : media.filter((m) => m.project_id === editing.id)}
          onClose={() => setEditing(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}

function IconBtn({ onClick, disabled, title, danger, children }: { onClick: () => void; disabled?: boolean; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="p-1.5 rounded-[6px] disabled:opacity-30 hover:bg-[#151515]"
      style={{ color: danger ? "#FF6B6B" : "#6E6E73" }}
    >
      {children}
    </button>
  );
}

function ProjectDrawer({
  project,
  services,
  media,
  onClose,
  onChanged,
}: {
  project: Project | null;
  services: Service[];
  media: Media[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState(project);
  const [businessName, setBusinessName] = useState(project?.business_name || "");
  const [industry, setIndustry] = useState(project?.industry || "");
  const [location, setLocation] = useState(project?.location || "");
  const [year, setYear] = useState(project?.year ? String(project.year) : "");
  const [projectType, setProjectType] = useState(project?.project_type || PROJECT_TYPES[0]);
  const [shortDescription, setShortDescription] = useState(project?.short_description || "");
  const [websiteUrl, setWebsiteUrl] = useState(project?.website_url || "");
  const [client, setClient] = useState(project?.case_study?.client || "");
  const [challenge, setChallenge] = useState(project?.case_study?.challenge || "");
  const [approach, setApproach] = useState(project?.case_study?.approach || "");
  const [build, setBuild] = useState(project?.case_study?.build || "");
  const [delivered, setDelivered] = useState(project?.case_study?.delivered || "");
  const [aiPresence, setAiPresence] = useState(project?.case_study?.aiPresence || "");
  const [serviceList, setServiceList] = useState(services.map((s) => s.service));
  const [serviceInput, setServiceInput] = useState("");
  const [mediaList, setMediaList] = useState(media);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addService() {
    if (serviceInput.trim()) {
      setServiceList((prev) => [...prev, serviceInput.trim()]);
      setServiceInput("");
    }
  }

  async function save() {
    if (!businessName.trim()) {
      setError("Business name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      businessName,
      industry,
      location,
      year: year ? parseInt(year) : null,
      projectType,
      shortDescription,
      websiteUrl,
      caseStudy: { client, challenge, approach, build, delivered, aiPresence },
      services: serviceList,
    };
    try {
      if (current) {
        const res = await fetch(`/api/team/portfolio/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error((await res.json()).error);
      } else {
        const res = await fetch("/api/team/portfolio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setCurrent(data.project); // switch to edit mode in place so media upload becomes available
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(type: string, file: File) {
    if (!current) return;
    setUploading(type);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("type", type);
      const res = await fetch(`/api/team/portfolio/${current.id}/media`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMediaList((prev) => [...prev, data.media]);
      if (type === "cover") setCurrent((c) => (c ? { ...c, cover_image_url: data.url } : c));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function deleteMedia(m: Media) {
    if (!current) return;
    await fetch(`/api/team/portfolio/${current.id}/media/${m.id}`, { method: "DELETE" });
    setMediaList((prev) => prev.filter((x) => x.id !== m.id));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.65)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto p-7" style={{ width: 520, background: "#111111", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="text-[17px] font-semibold text-[#F5F5F7]">{current ? "Edit Project" : "Add Project"}</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <Field label="Business Name">
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="pf-field" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry">
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className="pf-field" />
            </Field>
            <Field label="Location">
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="pf-field" />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input value={year} onChange={(e) => setYear(e.target.value)} className="pf-field" />
            </Field>
            <Field label="Project Type">
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className="pf-field">
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Website URL">
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://" className="pf-field" />
          </Field>

          <Field label="Short Description">
            <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="pf-field h-[60px] resize-none" />
          </Field>

          <Field label="Services">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {serviceList.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px]" style={{ background: "#1A1A1A", color: "#D0D0D0" }}>
                  {s}
                  <button onClick={() => setServiceList((prev) => prev.filter((_, idx) => idx !== i))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={serviceInput}
                onChange={(e) => setServiceInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService())}
                placeholder="e.g. Website Rebuild"
                className="pf-field flex-1"
              />
              <button onClick={addService} type="button" className="h-[38px] px-3 rounded-[8px] text-[12.5px]" style={{ background: "#1A1A1A", color: "#D0D0D0" }}>
                Add
              </button>
            </div>
          </Field>

          <div className="pt-2 border-t border-white/10">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-3">Case Study</div>
            <div className="flex flex-col gap-3">
              <Field label="The Client">
                <textarea value={client} onChange={(e) => setClient(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
              <Field label="The Challenge">
                <textarea value={challenge} onChange={(e) => setChallenge(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
              <Field label="The Approach">
                <textarea value={approach} onChange={(e) => setApproach(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
              <Field label="The Build">
                <textarea value={build} onChange={(e) => setBuild(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
              <Field label="What SFB Delivered">
                <textarea value={delivered} onChange={(e) => setDelivered(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
              <Field label="AI Presence Work (optional)">
                <textarea value={aiPresence} onChange={(e) => setAiPresence(e.target.value)} className="pf-field h-[54px] resize-none" />
              </Field>
            </div>
          </div>

          {current ? (
            <div className="pt-2 border-t border-white/10">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6E6E73] mb-3">Media</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {(["cover", "desktop", "mobile", "detail"] as const).map((type) => (
                  <label key={type} className="h-[38px] rounded-[8px] flex items-center justify-center gap-1.5 text-[12px] cursor-pointer capitalize" style={{ background: "#1A1A1A", color: "#D0D0D0", border: "1px solid rgba(255,255,255,0.08)" }}>
                    {uploading === type ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {type}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) uploadMedia(type, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                ))}
              </div>
              {mediaList.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {mediaList.map((m) => (
                    <div key={m.id} className="relative rounded-[6px] overflow-hidden aspect-square" style={{ background: "#0A0A0A" }}>
                      <img src={m.url} alt="" className="w-full h-full object-cover" />
                      <button onClick={() => deleteMedia(m)} className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/70 text-white">
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11.5px] text-[#6E6E73]">Save the project first, then media upload becomes available.</p>
          )}

          {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}

          <button onClick={save} disabled={saving} className="h-[44px] rounded-[8px] bg-white text-black text-[13.5px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mt-1">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Saving…" : current ? "Save Changes" : "Create Project"}
          </button>
        </div>

        <style jsx global>{`
          .pf-field {
            width: 100%;
            height: 38px;
            border-radius: 8px;
            padding: 0 10px;
            font-size: 13px;
            outline: none;
            background: #0a0a0a;
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: #f5f5f7;
          }
          textarea.pf-field {
            padding-top: 8px;
          }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      {children}
    </div>
  );
}
