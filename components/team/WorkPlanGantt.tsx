"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Diamond } from "lucide-react";

type Plan = { id: string; name: string; description: string | null; plan_type: string; start_date: string; end_date: string; status: string };
type Item = {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  row_index: number;
  visual_variant: "light" | "dark" | "teal";
  status: string;
  assigned_to: string | null;
};
type Milestone = { id: string; title: string; date: string; description: string | null };
type Rep = { id: string; label: string };

const VARIANT_STYLE: Record<string, { background: string; color: string }> = {
  light: { background: "#F3F3F3", color: "#151515" },
  dark: { background: "#29282F", color: "#F5F5F7" },
  teal: { background: "linear-gradient(90deg, #1F8E84 0%, #005B57 100%)", color: "#F5F5F7" },
};

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}

function pct(date: string, start: string, totalDays: number) {
  const offset = (new Date(date).getTime() - new Date(start).getTime()) / 86400000;
  return Math.min(100, Math.max(0, (offset / totalDays) * 100));
}

export default function WorkPlanGantt({ plan, items, milestones, isOwner, reps }: { plan: Plan; items: Item[]; milestones: Milestone[]; isOwner: boolean; reps: Rep[] }) {
  const router = useRouter();
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const totalDays = daysBetween(plan.start_date, plan.end_date);
  const months = totalDays / 30;
  const durationLabel = months >= 1 ? `${months.toFixed(1)} months` : `${totalDays} days`;

  const dateTicks = useMemo(() => {
    const ticks: { label: string; leftPct: number }[] = [];
    const count = 8;
    for (let i = 0; i <= count; i++) {
      const d = new Date(plan.start_date);
      d.setDate(d.getDate() + Math.round((totalDays / count) * i));
      ticks.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), leftPct: (i / count) * 100 });
    }
    return ticks;
  }, [plan.start_date, totalDays]);

  const todayPct = pct(new Date().toISOString(), plan.start_date, totalDays);
  const todayInRange = new Date() >= new Date(plan.start_date) && new Date() <= new Date(plan.end_date);

  const rowCount = Math.max(1, ...items.map((i) => i.row_index + 1));

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ padding: 54, background: "radial-gradient(circle at 12% 20%, rgba(20,199,183,0.10), transparent 35%), radial-gradient(circle at 90% 75%, rgba(20,199,183,0.08), transparent 38%), #0A0A0A" }}>
      <div style={{ width: "min(1120px, calc(100vw - 80px))", minHeight: 770, background: "#101010", border: "1px solid rgba(255,255,255,0.04)", borderRadius: 34, padding: "48px 58px 54px", boxShadow: "0 34px 100px rgba(0,0,0,0.36)", position: "relative", overflow: "hidden" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 42 }}>
          <div>
            <div style={{ fontSize: 31, fontWeight: 600, letterSpacing: "-0.025em", color: "#F5F5F7" }}>{plan.name}</div>
            {plan.description && <div style={{ fontSize: 13, color: "#767676", marginTop: 4 }}>{plan.description}</div>}
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 20, fontWeight: 400, color: "#A7A7A7" }}>{durationLabel}</span>
            {isOwner && (
              <>
                <button onClick={() => setShowAddMilestone(true)} className="h-[34px] px-3 rounded-[8px] text-[12.5px]" style={{ background: "#1B1B1B", color: "#E0E0E0", border: "1px solid rgba(255,255,255,0.1)" }}>
                  + Milestone
                </button>
                <button onClick={() => setShowAddTask(true)} className="h-[34px] px-3 inline-flex items-center gap-1.5 rounded-[8px] bg-white text-black text-[12.5px] font-semibold">
                  <Plus size={13} /> Task
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative" style={{ height: 590 }}>
          {/* date axis */}
          <div className="relative" style={{ height: 30, marginBottom: 24 }}>
            {dateTicks.map((t, i) => (
              <span key={i} className="absolute" style={{ left: `${t.leftPct}%`, fontSize: 13, color: "#A6A6A6", transform: i === dateTicks.length - 1 ? "translateX(-100%)" : undefined }}>
                {t.label}
              </span>
            ))}
          </div>

          <div className="relative" style={{ height: rowCount * 66 + 40 }}>
            {/* now line */}
            {todayInRange && (
              <div className="absolute top-0 bottom-0" style={{ left: `${todayPct}%`, width: 2, background: "linear-gradient(to bottom, rgba(32,199,183,0), #20C7B7 8%, #20C7B7 94%, rgba(32,199,183,0))", boxShadow: "0 0 16px rgba(32,199,183,0.30)" }}>
                <span className="absolute" style={{ top: -26, left: "50%", transform: "translateX(-50%)", background: "#194E48", color: "#E9FFFC", borderRadius: 6, padding: "4px 8px", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap" }}>
                  Now
                </span>
              </div>
            )}

            {/* task rows */}
            {items.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[13px] text-[#6E6E73]">No tasks yet.</div>
            ) : (
              items.map((item) => {
                const left = pct(item.start_date, plan.start_date, totalDays);
                const width = Math.max(4, pct(item.end_date, plan.start_date, totalDays) - left);
                const style = VARIANT_STYLE[item.visual_variant];
                const days = daysBetween(item.start_date, item.end_date);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="absolute flex items-center justify-between text-left"
                    style={{ top: item.row_index * 66, left: `${left}%`, width: `${width}%`, height: 54, borderRadius: 12, padding: "0 16px 0 20px", fontSize: 15, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,0.20)", ...style }}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="shrink-0 ml-2" style={{ height: 25, padding: "0 10px", background: "#F4F4F4", color: "#151515", borderRadius: 6, display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600 }}>
                      {days}d
                    </span>
                  </button>
                );
              })
            )}

            {/* milestones */}
            {milestones.map((m) => {
              const left = pct(m.date, plan.start_date, totalDays);
              return (
                <div key={m.id} className="absolute flex items-center" style={{ top: rowCount * 66 + 4, left: `${left}%`, transform: "translateX(-50%)" }}>
                  <Diamond size={18} fill="#29282F" color="#29282F" />
                  <span style={{ fontSize: 13, color: "#F2F2F2", marginLeft: 10, whiteSpace: "nowrap" }}>{m.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showAddTask && <TaskDrawer planId={plan.id} reps={reps} onClose={() => setShowAddTask(false)} onSaved={() => { setShowAddTask(false); router.refresh(); }} />}
      {showAddMilestone && <MilestoneDrawer planId={plan.id} onClose={() => setShowAddMilestone(false)} onSaved={() => { setShowAddMilestone(false); router.refresh(); }} />}
      {selectedItem && (
        <ItemDetailDrawer
          planId={plan.id}
          item={selectedItem}
          isOwner={isOwner}
          reps={reps}
          onClose={() => setSelectedItem(null)}
          onChanged={() => {
            setSelectedItem(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskDrawer({ planId, reps, onClose, onSaved }: { planId: string; reps: Rep[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rowIndex, setRowIndex] = useState(0);
  const [visualVariant, setVisualVariant] = useState<"light" | "dark" | "teal">("dark");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !startDate || !endDate) {
      setError("Title, start date, and end date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/work-plans/${planId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, startDate, endDate, rowIndex, visualVariant, assignedTo: assignedTo || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title="Add Task" onClose={onClose}>
      <FieldInput label="Title" value={title} onChange={setTitle} />
      <FieldTextarea label="Description" value={description} onChange={setDescription} />
      <div className="grid grid-cols-2 gap-2">
        <FieldDate label="Start" value={startDate} onChange={setStartDate} />
        <FieldDate label="End" value={endDate} onChange={setEndDate} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldNumber label="Row" value={rowIndex} onChange={setRowIndex} />
        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Style</label>
          <select value={visualVariant} onChange={(e) => setVisualVariant(e.target.value as any)} className="sfb-field">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="teal">Teal</option>
          </select>
        </div>
      </div>
      {reps.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Assign To</label>
          <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="sfb-field">
            <option value="">Unassigned</option>
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
      <button onClick={submit} disabled={saving} className="h-[40px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5">
        {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Adding…" : "Add Task"}
      </button>
    </Drawer>
  );
}

function MilestoneDrawer({ planId, onClose, onSaved }: { planId: string; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || !date) {
      setError("Title and date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/team/work-plans/${planId}/milestones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add milestone.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer title="Add Milestone" onClose={onClose}>
      <FieldInput label="Title" value={title} onChange={setTitle} />
      <FieldDate label="Date" value={date} onChange={setDate} />
      <FieldTextarea label="Description" value={description} onChange={setDescription} />
      {error && <p className="text-[12.5px] text-[#FF453A]">{error}</p>}
      <button onClick={submit} disabled={saving} className="h-[40px] rounded-[8px] bg-white text-black text-[13px] font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5">
        {saving ? <Loader2 size={14} className="animate-spin" /> : null} {saving ? "Adding…" : "Add Milestone"}
      </button>
    </Drawer>
  );
}

function ItemDetailDrawer({ planId, item, isOwner, reps, onClose, onChanged }: { planId: string; item: Item; isOwner: boolean; reps: Rep[]; onClose: () => void; onChanged: () => void }) {
  const [status, setStatus] = useState(item.status);
  const [saving, setSaving] = useState(false);

  async function updateStatus(newStatus: string) {
    setStatus(newStatus);
    setSaving(true);
    try {
      await fetch(`/api/team/work-plans/${planId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/team/work-plans/${planId}/items/${item.id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <Drawer title={item.title} onClose={onClose}>
      {item.description && <p className="text-[13px] text-[#A1A1A6] leading-relaxed">{item.description}</p>}
      <div className="text-[12.5px] text-[#6E6E73]">
        {new Date(item.start_date).toLocaleDateString()} – {new Date(item.end_date).toLocaleDateString()} ({daysBetween(item.start_date, item.end_date)} days)
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">Status</label>
        <select value={status} onChange={(e) => updateStatus(e.target.value)} disabled={saving} className="sfb-field">
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="blocked">Blocked</option>
          <option value="complete">Complete</option>
        </select>
      </div>
      {isOwner && (
        <button onClick={deleteItem} className="h-[36px] rounded-[8px] text-[12.5px] text-[#FF453A]" style={{ border: "1px solid rgba(255,69,58,0.3)" }}>
          Delete Task
        </button>
      )}
    </Drawer>
  );
}

function Drawer({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="h-full overflow-y-auto p-6 flex flex-col gap-3" style={{ width: 420, background: "#151515", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[16px] font-semibold text-[#F5F5F7]">{title}</div>
          <button onClick={onClose} className="text-[#6E6E73] hover:text-white">
            <X size={16} />
          </button>
        </div>
        {children}
        <style jsx global>{`
          .sfb-field {
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
        `}</style>
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="sfb-field" />
    </div>
  );
}
function FieldTextarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} className="sfb-field h-[70px] resize-none" />
    </div>
  );
}
function FieldDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="sfb-field" />
    </div>
  );
}
function FieldNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10.5px] uppercase tracking-wide text-[#6E6E73]">{label}</label>
      <input type="number" min={0} value={value} onChange={(e) => onChange(Number(e.target.value))} className="sfb-field" />
    </div>
  );
}
