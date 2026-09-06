"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCw,
  Share2,
  Home,
  Calendar,
  Users,
  FileText,
  BarChart3,
  Settings,
  Workflow,
  MessageSquareText,
  GitBranch,
  BrainCircuit,
  Monitor,
  GraduationCap,
  FlaskConical,
  Plug,
  ShieldCheck,
  Map as MapIcon,
  Archive,
  Bookmark,
  Paperclip,
  Trash2,
  Mail,
  Download,
  Copy,
  Plus,
  X,
  Loader2,
  SlidersHorizontal,
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
  creator_name: string | null;
  bookmarked: boolean;
};

function formatBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const NAV_ITEMS = [
  { label: "Dashboard", icon: Home, href: "/team/dashboard" },
  { label: "Calendar", icon: Calendar, href: "/team/calendar" },
  { label: "Team", icon: Users, href: "/team/team" },
  { label: "Docs", icon: FileText, href: "/team/docs" },
  { label: "Reporting", icon: BarChart3, href: "/team/performance" },
  { label: "Settings", icon: Settings, href: "/team/settings" },
];

export default function DocsWorkspace({
  isOwner,
  categories,
  folders,
  activity30,
  archiveDocs,
  activeCategory,
}: {
  isOwner: boolean;
  categories: Category[];
  folders: Folder[];
  activity30: ActivityEvent[];
  archiveDocs: Doc[];
  activeCategory: string | null;
}) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    <div className="min-h-screen flex items-center justify-center p-[50px]" style={{ background: "#EAEAEA" }}>
      <div
        className="flex flex-col overflow-hidden"
        style={{ width: "calc(100vw - 100px)", maxWidth: 1400, height: "calc(100vh - 100px)", minHeight: 780, background: "#151515", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,0.28)" }}
      >
        {/* fake browser chrome */}
        <div className="grid items-center shrink-0" style={{ height: 48, background: "#050505", borderBottom: "1px solid rgba(255,255,255,0.05)", gridTemplateColumns: "220px 1fr 220px", padding: "0 14px" }}>
          <div className="flex items-center gap-2.5">
            <span className="w-[10px] h-[10px] rounded-full" style={{ background: "#FF5F57" }} />
            <span className="w-[10px] h-[10px] rounded-full" style={{ background: "#FFBD2E" }} />
            <span className="w-[10px] h-[10px] rounded-full" style={{ background: "#28C840" }} />
            <ChevronLeft size={13} className="text-[#5c5c5c] ml-2" />
            <ChevronRight size={13} className="text-[#5c5c5c]" />
          </div>
          <div className="justify-self-center flex items-center gap-1.5" style={{ width: 400, maxWidth: "45vw", height: 26, background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7 }}>
            <Lock size={10} className="text-[#8a8a8a] ml-3" />
            <span className="text-[11px] text-[#BDBDBD] flex-1 text-center">sfbconnect.com/team/docs</span>
            <RotateCw size={10} className="text-[#8a8a8a] mr-3" />
          </div>
          <div className="justify-self-end">
            <Share2 size={14} className="text-[#8a8a8a]" />
          </div>
        </div>

        <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "220px minmax(0,1fr) 270px", background: "#151515" }}>
          {/* inner sidebar */}
          <div className="overflow-y-auto p-3" style={{ background: "#1C1C1C", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex flex-col gap-[1px]">
              {NAV_ITEMS.map((item) => {
                const active = item.label === "Docs";
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="flex items-center gap-2 rounded-[6px] text-[11px]"
                    style={{ height: 30, padding: "0 8px", background: active ? "#F2F2F2" : "transparent", color: active ? "#111111" : "#A7A7A7" }}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="mt-4 mb-1.5 px-2 text-[10px] font-medium text-[#B9B9B9]">Projects</div>
            {[
              { label: "SFB Sales OS", color: "#7ED957" },
              { label: "SFB Website", color: "#FF9F0A" },
              { label: "AI Presence Engine", color: "#0A84FF" },
              { label: "Automation Systems", color: "#FF375F" },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2 rounded-[6px] text-[11px] text-[#A7A7A7]" style={{ height: 28, padding: "0 8px" }}>
                <span className="w-[6px] h-[6px] rounded-full" style={{ background: p.color }} />
                {p.label}
              </div>
            ))}
          </div>

          {/* main */}
          <div className="overflow-y-auto" style={{ background: "#181818", padding: "18px 16px 28px" }}>
            <div className="flex items-end justify-between mb-1">
              <div>
                <div className="text-[11px] text-[#A3A3A3]">Docs</div>
                <div className="text-[34px] font-normal text-[#F5F5F7]" style={{ letterSpacing: "-0.03em" }}>
                  Docs
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="h-[34px] px-3.5 inline-flex items-center gap-1.5 rounded-[7px] bg-white text-black text-[12px] font-semibold"
                  >
                    <Plus size={13} /> Add Document
                  </button>
                )}
                {activeCategory && (
                  <Link href="/team/docs" className="h-[34px] px-3 inline-flex items-center gap-1.5 rounded-[7px] text-[12px] text-[#D0D0D0]" style={{ background: "#242424", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <SlidersHorizontal size={12} /> Clear filter
                  </Link>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              {categories.map((c) => {
                const Icon = ICONS[c.icon] || FileText;
                return (
                  <div key={c.key} className="flex flex-col" style={{ height: 148, background: "#222222", border: "1px solid rgba(255,255,255,0.055)", borderRadius: 8, padding: 12 }}>
                    <div className="w-7 h-7 rounded-[6px] flex items-center justify-center" style={{ background: "#F2F2F2" }}>
                      <Icon size={14} color="#1B1B1B" />
                    </div>
                    <div className="text-[11px] font-medium text-[#F1F1F1] mt-3">{c.title}</div>
                    <div className="text-[9px] leading-[1.35] text-[#929292] mt-1 flex-1">{c.description}</div>
                    <div className="flex items-center justify-between mt-1">
                      <Link href={`/team/docs?category=${c.key}`} className="h-5 px-2.5 inline-flex items-center rounded-[5px] text-[8px] text-[#D0D0D0]" style={{ background: "#303030", border: "1px solid rgba(255,255,255,0.06)" }}>
                        Open
                      </Link>
                      <span className="text-[9px] text-[#6E6E73]">{c.count} file{c.count === 1 ? "" : "s"}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-[14px] rounded-[8px] p-3" style={{ background: "#202020", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="text-[13px] text-[#ECECEC] mb-3">Shortcut</div>
              <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" }}>
                {folders.map((f) => {
                  const Icon = ICONS[f.icon || "FileText"] || FileText;
                  return (
                    <div key={f.id} className="flex flex-col items-center">
                      <div className="flex items-center justify-center" style={{ width: 64, height: 54, background: "#454545", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10 }}>
                        <Icon size={20} className="text-[#D0D0D0]" />
                      </div>
                      <div className="text-[9px] text-[#D0D0D0] text-center mt-1.5">{f.name}</div>
                      <div className="text-[8px] text-[#6E6E73]">{f.count} file{f.count === 1 ? "" : "s"}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid mt-[14px] gap-3" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <div className="rounded-[8px] p-3" style={{ background: "#202020", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-[12px] text-[#D6D6D6] mb-2">Documentation Engagement Trend</div>
                {activity30.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-[12px] text-[#6E6E73]">No activity in the last 30 days yet.</div>
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
              <div className="rounded-[8px] p-3" style={{ background: "#202020", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-[12px] text-[#D6D6D6] mb-2">Activity by Type (30d)</div>
                {eventTypeCounts.length === 0 ? (
                  <div className="h-[145px] flex items-center justify-center text-[12px] text-[#6E6E73]">No data yet.</div>
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
          </div>

          {/* right archive panel */}
          <div className="overflow-y-auto p-3" style={{ background: "#1D1D1D", borderLeft: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[14px] text-[#F1F1F1] mb-2">{activeCategory ? "Filtered Documents" : "Recent Documents"}</div>
            <p className="text-[9px] text-[#898989] leading-[1.4] mb-3">Plans, documentation, training files, process updates, and internal SFB records.</p>

            {toast && <div className="mb-3 text-[10px] text-[#F5F5F7] px-2 py-1.5 rounded-[6px]" style={{ background: "#272727" }}>{toast}</div>}

            {archiveDocs.length === 0 ? (
              <div className="rounded-[7px] p-4 text-center text-[11px] text-[#6E6E73]" style={{ background: "#222222", border: "1px solid rgba(255,255,255,0.05)" }}>
                No documents yet.
              </div>
            ) : (
              archiveDocs.map((d) => (
                <div key={d.id} className="rounded-[7px] p-2.5 mt-2.5" style={{ background: "#222222", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="text-[10px] text-[#E5E5E5] truncate">{d.title}</div>
                  <div className="text-[8px] text-[#8C8C8C] leading-[1.5]">
                    {d.creator_name || "SFB Connect"} · {formatBytes(d.file_size_bytes)} · {new Date(d.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <button onClick={() => handleBookmark(d.id)} className="p-1.5 rounded-[5px] hover:bg-[#2c2c2c]" title="Bookmark">
                      <Bookmark size={12} fill={d.bookmarked ? "#F5F5F7" : "none"} className="text-[#D0D0D0]" />
                    </button>
                    {d.file_path && (
                      <button onClick={() => handleDownload(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-[5px] hover:bg-[#2c2c2c]" title="Download">
                        {busyId === d.id ? <Loader2 size={12} className="animate-spin text-[#D0D0D0]" /> : <Download size={12} className="text-[#D0D0D0]" />}
                      </button>
                    )}
                    <button onClick={() => copyLink(d.id)} className="p-1.5 rounded-[5px] hover:bg-[#2c2c2c]" title="Copy link">
                      <Copy size={12} className="text-[#D0D0D0]" />
                    </button>
                    <a href={`mailto:?subject=${encodeURIComponent(d.title)}`} className="p-1.5 rounded-[5px] hover:bg-[#2c2c2c]" title="Email">
                      <Mail size={12} className="text-[#D0D0D0]" />
                    </a>
                    {isOwner && (
                      <button onClick={() => handleDelete(d.id)} disabled={busyId === d.id} className="p-1.5 rounded-[5px] hover:bg-[#2c2c2c] ml-auto" title="Delete">
                        <Trash2 size={12} className="text-[#FF6B6B]" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAdd && <AddDocumentModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); router.refresh(); }} />}
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
