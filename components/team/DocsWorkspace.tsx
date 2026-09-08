"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Workflow,
  MessageSquareText,
  GitBranch,
  BrainCircuit,
  Monitor,
  GraduationCap,
  FlaskConical,
  Plug,
  FileText,
  BarChart3,
  ShieldCheck,
  Map as MapIcon,
  Archive,
  Bookmark,
  Trash2,
  Mail,
  Download,
  Copy,
  Plus,
  X,
  Loader2,
  SlidersHorizontal,
  Search,
} from "lucide-react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from "recharts";

const ICONS: Record<string, React.ElementType> = {
  Workflow,
  MessageSquareText,
  GitBranch,
  BrainCircuit,
  Monitor,
  GraduationCap,
  FlaskConical,
  Plug,
  FileText,
  BarChart3,
  ShieldCheck,
  Map: MapIcon,
  Archive,
};

type Category = { key: string; title: string; description: string; icon: string; count: number };
type Folder = { id: string; name: string; icon: string | null; count: number };
type ActivityEvent = { event_type: string; created_at: string };
type Doc = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  file_path: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  visibility: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  creator_name: string | null;
  bookmarked: boolean;
};

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocsWorkspace({
  isOwner,
  categories,
  folders,
  activity30,
  allDocs,
  activeCategory,
}: {
  isOwner: boolean;
  categories: Category[];
  folders: Folder[];
  activity30: ActivityEvent[];
  allDocs: Doc[];
  activeCategory: string | null;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "recent">("all");

  // The document list only appears when there's a real reason to show one --
  // a search, a category filter, or the "Recently updated" view. Otherwise
  // the page stays the clean category/shortcut/analytics overview (no
  // permanent side rail duplicating the real navigation).
  const visibleDocs = useMemo(() => {
    let docs = allDocs;
    if (activeCategory) docs = docs.filter((d) => d.category === activeCategory);
    if (query.trim()) {
      const q = query.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q));
    }
    if (filter === "recent") {
      docs = [...docs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 10);
    }
    return docs;
  }, [allDocs, activeCategory, query, filter]);

  const showDocList = !!activeCategory || !!query.trim() || filter === "recent";

  const engagementSeries = useMemo(() => {
    const buckets = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const e of activity30) {
      const key = e.created_at.slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return Array.from(buckets.entries()).map(([date, count]) => ({ date: new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" }), count }));
  }, [activity30]);

  const eventTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of activity30) counts[e.event_type] = (counts[e.event_type] || 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [activity30]);

  const PIE_COLORS = ["#F0F0F0", "#7B7B7B", "#3A3A3A", "#5A5A5A"];

  async function handleDownload(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/team/documents/${id}/download`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.open(data.url, "_blank");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not download.");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setBusyId(null);
    }
  }

  async function handleBookmark(id: string) {
    await fetch(`/api/team/documents/${id}/bookmark`, { method: "POST" });
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document permanently?")) return;
    setBusyId(id);
    try {
      await fetch(`/api/team/documents/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function copyLink(id: string) {
    navigator.clipboard.writeText(`${window.location.origin}/team/docs?doc=${id}`);
    setToast("Link copied.");
    setTimeout(() => setToast(null), 2000);
  }

  return (
    <div className="px-8 pt-16 pb-8">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#6E6E73] mb-1">Workspace</div>
          <div className="text-[24px] font-semibold text-[#F5F5F7]" style={{ letterSpacing: "-0.02em" }}>
            Docs
          </div>
          <div className="text-[13px] text-[#707078] mt-[5px]">Central knowledge, scripts, training, processes and internal resources for the SFB team.</div>
        </div>
        {isOwner && (
          <button onClick={() => setShowAdd(true)} className="h-[38px] px-4 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[13px] font-semibold">
            <Plus size={14} /> Add Document
          </button>
        )}
      </div>

      <div className="flex items-center gap-[9px] mt-7 flex-wrap">
        <div className="flex items-center gap-2 h-[39px] rounded-[8px] px-3" style={{ width: 300, background: "#0c0c0d", border: "1px solid #242426" }}>
          <Search size={14} className="text-[#6E6E73] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents..."
            className="w-full bg-transparent text-[13px] text-[#F5F5F7] placeholder:text-[#6E6E73] outline-none"
          />
        </div>
        <button
          onClick={() => setFilter("all")}
          className="h-[39px] px-3.5 rounded-[8px] text-[12.5px]"
          style={{ background: filter === "all" ? "#18181a" : "#0c0c0d", border: "1px solid #242426", color: filter === "all" ? "#F5F5F7" : "#929297" }}
        >
          All documents
        </button>
        <button
          onClick={() => setFilter("recent")}
          className="h-[39px] px-3.5 rounded-[8px] text-[12.5px]"
          style={{ background: filter === "recent" ? "#18181a" : "#0c0c0d", border: "1px solid #242426", color: filter === "recent" ? "#F5F5F7" : "#929297" }}
        >
          Recently updated
        </button>
        {activeCategory && (
          <Link href="/team/docs" className="h-[39px] px-3.5 inline-flex items-center gap-1.5 rounded-[8px] text-[12.5px] text-[#D0D0D0]" style={{ background: "#0c0c0d", border: "1px solid #242426" }}>
            <SlidersHorizontal size={12} /> Clear category filter
          </Link>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-[22px]">
        {categories.map((c) => {
          const Icon = ICONS[c.icon] || FileText;
          const isActive = activeCategory === c.key;
          return (
            <div
              key={c.key}
              className="flex flex-col transition-colors"
              style={{ minHeight: 157, background: isActive ? "#101011" : "#0c0c0d", border: `1px solid ${isActive ? "#323235" : "#242426"}`, borderRadius: 10, padding: 16 }}
            >
              <div className="w-[34px] h-[34px] rounded-[7px] flex items-center justify-center" style={{ background: "#efefef" }}>
                <Icon size={16} color="#171719" />
              </div>
              <div className="text-[14px] font-medium text-[#eeeeef] mt-4">{c.title}</div>
              <div className="text-[11px] leading-[1.45] text-[#74747a] mt-1 flex-1">{c.description}</div>
              <div className="flex items-center justify-between mt-2.5">
                <Link href={`/team/docs?category=${c.key}`} className="h-[28px] px-2.5 inline-flex items-center rounded-[6px] text-[11.5px] text-[#D0D0D0]" style={{ background: "#171719", border: "1px solid #29292c" }}>
                  Open
                </Link>
                <span className="text-[10.5px] text-[#6E6E73]">
                  {c.count} file{c.count === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {showDocList && (
        <div className="mt-[15px] rounded-[10px] overflow-hidden" style={{ background: "#0c0c0d", border: "1px solid #242426" }}>
          <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid #242426" }}>
            <div className="text-[13px] font-medium text-[#F1F1F1]">
              {query.trim() ? `Results for "${query}"` : activeCategory ? categories.find((c) => c.key === activeCategory)?.title || "Filtered Documents" : "Recently Updated"}
            </div>
            <span className="text-[11.5px] text-[#6E6E73]">
              {visibleDocs.length} document{visibleDocs.length === 1 ? "" : "s"}
            </span>
          </div>

          {toast && (
            <div className="mx-4 mt-3 text-[11px] text-[#F5F5F7] px-2.5 py-1.5 rounded-[6px]" style={{ background: "#1a1a1c" }}>
              {toast}
            </div>
          )}

          {visibleDocs.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#6E6E73]">No documents match.</div>
          ) : (
            <div className="flex flex-col">
              {visibleDocs.map((d, i) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i > 0 ? "1px solid #1e1e20" : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[13px] text-[#E5E5E5] truncate">{d.title}</div>
                    <div className="text-[11px] text-[#8C8C8C] mt-0.5">
                      {d.creator_name || "SFB Connects"} · {formatBytes(d.file_size_bytes)} · Updated {new Date(d.updated_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <button onClick={() => handleBookmark(d.id)} className="p-1.5 rounded-[5px] hover:bg-[#1e1e20]" title="Bookmark">
                      <Bookmark size={13} fill={d.bookmarked ? "#F5F5F7" : "none"} className="text-[#D0D0D0]" />
                    </button>
                    {d.file_path && (
                      <button onClick={() => handleDownload(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-[5px] hover:bg-[#1e1e20]" title="Download">
                        {busyId === d.id ? <Loader2 size={13} className="animate-spin text-[#D0D0D0]" /> : <Download size={13} className="text-[#D0D0D0]" />}
                      </button>
                    )}
                    <button onClick={() => copyLink(d.id)} className="p-1.5 rounded-[5px] hover:bg-[#1e1e20]" title="Copy link">
                      <Copy size={13} className="text-[#D0D0D0]" />
                    </button>
                    <a href={`mailto:?subject=${encodeURIComponent(d.title)}`} className="p-1.5 rounded-[5px] hover:bg-[#1e1e20]" title="Email">
                      <Mail size={13} className="text-[#D0D0D0]" />
                    </a>
                    {isOwner && (
                      <button onClick={() => handleDelete(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-[5px] hover:bg-[#1e1e20]" title="Delete">
                        <Trash2 size={13} className="text-[#FF6B6B]" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-[15px] rounded-[10px] p-4" style={{ background: "#0c0c0d", border: "1px solid #242426" }}>
        <div className="text-[13px] text-[#ECECEC] mb-3.5">Shortcuts</div>
        {folders.length === 0 ? (
          <div className="text-[12.5px] text-[#6E6E73]">No folders yet — folders you create show up here.</div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" }}>
            {folders.map((f) => {
              const Icon = ICONS[f.icon || "FileText"] || FileText;
              return (
                <Link key={f.id} href={`/team/docs`} className="flex flex-col items-center group">
                  <div
                    className="flex items-center justify-center transition-colors group-hover:border-[#4a4a4e]"
                    style={{ width: 58, height: 58, background: "#242426", border: "1px solid #38383b", borderRadius: 11 }}
                  >
                    <Icon size={20} className="text-[#D0D0D0]" />
                  </div>
                  <div className="text-[11px] text-[#b4b4b8] text-center mt-1.5">{f.name}</div>
                  <div className="text-[10px] text-[#5d5d62]">
                    {f.count} file{f.count === 1 ? "" : "s"}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid mt-[15px] gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="rounded-[10px] p-[15px]" style={{ background: "#0c0c0d", border: "1px solid #242426" }}>
          <div className="text-[12px] text-[#D6D6D6] mb-2">Documentation Engagement Trend</div>
          {activity30.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-[13px] text-[#5f5f65]">No activity in the last 30 days yet.</div>
          ) : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={engagementSeries} margin={{ top: 6, right: 6, left: -30, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={30} />
                  <Tooltip contentStyle={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} labelStyle={{ color: "#F5F5F7", fontSize: 11 }} itemStyle={{ color: "#D0D0D0", fontSize: 11 }} />
                  <Line type="monotone" dataKey="count" stroke="#C16A3A" strokeWidth={2} dot={{ r: 2, fill: "#FF375F" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
        <div className="rounded-[10px] p-[15px]" style={{ background: "#0c0c0d", border: "1px solid #242426" }}>
          <div className="text-[12px] text-[#D6D6D6] mb-2">Activity by Type (30d)</div>
          {eventTypeCounts.length === 0 ? (
            <div className="h-[145px] flex items-center justify-center text-[13px] text-[#5f5f65]">No data yet.</div>
          ) : (
            <div style={{ height: 145 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={eventTypeCounts} dataKey="value" nameKey="name" innerRadius={38} outerRadius={58} stroke="none">
                    {eventTypeCounts.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8 }} labelStyle={{ color: "#F5F5F7", fontSize: 11 }} itemStyle={{ color: "#D0D0D0", fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {showAdd && (
        <AddDocumentModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AddDocumentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("sales_sop");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("team");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("title", title);
      form.set("category", category);
      form.set("description", description);
      form.set("visibility", visibility);
      if (file) form.set("file", file);
      const res = await fetch("/api/team/documents", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save document.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-[420px] rounded-[14px] p-6" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-[15px] font-semibold text-[#F5F5F7]">Add Document</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
            <option value="sales_sop">Sales SOP</option>
            <option value="sales_scripts">Sales Scripts</option>
            <option value="objection_library">Objection Library</option>
            <option value="ai_presence_knowledge">AI Presence Knowledge</option>
            <option value="website_services">Website Services</option>
            <option value="training_onboarding">Training & Onboarding</option>
            <option value="other">Other</option>
          </select>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" className="h-[70px] resize-none rounded-[8px] p-2.5 text-[13px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }} />
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="h-[38px] rounded-[8px] px-3 text-[13px] outline-none" style={{ background: "#101010", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}>
            <option value="team">Visible to team</option>
            <option value="owner_only">Owner only</option>
          </select>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-[12px] text-[#A1A1A6]" />
          {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
          <button onClick={submit} disabled={saving} className="h-[40px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60">
            {saving ? "Saving…" : "Save Document"}
          </button>
        </div>
      </div>
    </div>
  );
}
