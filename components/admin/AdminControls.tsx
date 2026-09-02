"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_STATUS_ORDER, PROJECT_STATUS_LABELS, AUDIT_CATEGORIES } from "@/lib/types";

async function postJson(url: string, body: unknown, method: string = "POST") {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || "Request failed.");
  }
  return res.json();
}

export function StatusControl({ projectId, currentStatus }: { projectId: string; currentStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/status`, { status }, "PATCH");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm outline-none"
      >
        {PROJECT_STATUS_ORDER.map((s) => (
          <option key={s} value={s} className="bg-black">
            {PROJECT_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <button
        onClick={apply}
        disabled={loading || status === currentStatus}
        className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
      >
        {loading ? "Updating…" : "Update Status"}
      </button>
      {error && <span className="text-sm text-red-400">{error}</span>}
    </div>
  );
}

export function ScoreForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [values, setValues] = useState({
    overall_score: "",
    identity_score: "",
    knowledge_score: "",
    authority_score: "",
    location_score: "",
    machine_readability_score: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/score`, {
        overall_score: Number(values.overall_score),
        identity_score: Number(values.identity_score),
        knowledge_score: Number(values.knowledge_score),
        authority_score: Number(values.authority_score),
        location_score: Number(values.location_score),
        machine_readability_score: Number(values.machine_readability_score),
      });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const fields: [keyof typeof values, string][] = [
    ["overall_score", "Overall"],
    ["identity_score", "Identity"],
    ["knowledge_score", "Knowledge"],
    ["authority_score", "Authority"],
    ["location_score", "Location"],
    ["machine_readability_score", "Machine Readability"],
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {fields.map(([key, label]) => (
        <label key={key} className="flex flex-col gap-1.5">
          <span className="text-[12px] text-medium-gray">{label}</span>
          <input
            type="number"
            min={0}
            max={100}
            value={values[key]}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
          />
        </label>
      ))}
      <div className="col-span-2 md:col-span-3 flex items-center gap-3 mt-1">
        <button
          onClick={submit}
          disabled={loading || !values.overall_score}
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
        >
          {loading ? "Saving…" : "Record Score"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export function FindingForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [categoryName, setCategoryName] = useState(AUDIT_CATEGORIES[0]);
  const [severity, setSeverity] = useState("moderate");
  const [finding, setFinding] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/findings`, {
        categoryName,
        severity,
        finding,
        recommendation,
      });
      setFinding("");
      setRecommendation("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <select
          value={categoryName}
          onChange={(e) => setCategoryName(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
        >
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-black">
              {c}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
        >
          {["info", "minor", "moderate", "critical"].map((s) => (
            <option key={s} value={s} className="bg-black">
              {s}
            </option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Finding"
        value={finding}
        onChange={(e) => setFinding(e.target.value)}
        rows={2}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <textarea
        placeholder="Recommendation (optional)"
        value={recommendation}
        onChange={(e) => setRecommendation(e.target.value)}
        rows={2}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !finding.trim()}
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 self-start"
        >
          {loading ? "Adding…" : "Add Finding"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export function RecommendationForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/recommendations`, {
        title,
        description,
        priority,
      });
      setTitle("");
      setDescription("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[1fr_140px] gap-3">
        <input
          placeholder="Recommendation title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
        >
          {["low", "medium", "high"].map((p) => (
            <option key={p} value={p} className="bg-black">
              {p}
            </option>
          ))}
        </select>
      </div>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !title.trim()}
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 self-start"
        >
          {loading ? "Adding…" : "Add Recommendation"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export function NoteForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/notes`, { note });
      setNote("");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        placeholder="Internal note (not visible to customer)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !note.trim()}
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 self-start"
        >
          {loading ? "Saving…" : "Add Note"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}

export function PublishReportForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [fileUrl, setFileUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      await postJson(`/api/admin/projects/${projectId}/report`, { fileUrl, summary });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        placeholder="Report file URL (Supabase Storage link)"
        value={fileUrl}
        onChange={(e) => setFileUrl(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
      />
      <textarea
        placeholder="Summary"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        rows={2}
        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none resize-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={submit}
          disabled={loading || !fileUrl.trim()}
          className="bg-white text-black px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-40 self-start"
        >
          {loading ? "Publishing…" : "Publish Report & Mark Completed"}
        </button>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  );
}
