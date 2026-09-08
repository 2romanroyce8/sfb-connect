"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { SERVICE_INTERESTS } from "@/lib/marketing/serviceInterests";

// Shared "Request a Quote" / "Discuss X" / "Build My Website" intake form
// used across every new service page. Always POSTs to the real
// /api/services/inquiry endpoint -- there is no page that fakes submission.
export default function ServiceInquiryForm({
  defaultInterest,
  ctaLabel = "Send Request",
  title = "Tell us about your business",
}: {
  defaultInterest?: (typeof SERVICE_INTERESTS)[number];
  ctaLabel?: string;
  title?: string;
}) {
  const [serviceInterest, setServiceInterest] = useState<(typeof SERVICE_INTERESTS)[number]>(defaultInterest || "Not Sure");
  const [businessName, setBusinessName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessName.trim() || !email.trim()) {
      setError("Business name and email are required.");
      return;
    }
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/services/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceInterest, businessName, name, email, phone, website, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div
        className="rounded-[14px] p-8 text-center"
        style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <div className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center mx-auto mb-4">
          <Check size={20} />
        </div>
        <div className="text-[18px] font-medium text-white mb-1.5">Request received</div>
        <p className="text-[14px] text-white/50 max-w-[380px] mx-auto">
          Thanks — someone from SFB Connects will follow up with you shortly.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-[14px] p-7 flex flex-col gap-4" style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.09)" }}>
      <div className="text-[15px] font-medium text-white mb-1">{title}</div>

      <Field label="What are you interested in?">
        <select value={serviceInterest} onChange={(e) => setServiceInterest(e.target.value as any)} className="sfb-inquiry-field">
          {SERVICE_INTERESTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Business Name">
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="sfb-inquiry-field" />
        </Field>
        <Field label="Your Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className="sfb-inquiry-field" />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="sfb-inquiry-field" />
        </Field>
        <Field label="Phone (optional)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="sfb-inquiry-field" />
        </Field>
      </div>

      <Field label="Current Website (optional)">
        <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="sfb-inquiry-field" />
      </Field>

      <Field label="Message (optional)">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} className="sfb-inquiry-field h-[80px] resize-none" />
      </Field>

      {error && <p className="text-[12.5px] text-[#FF6B6B]">{error}</p>}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="h-[46px] rounded-[8px] bg-white text-black text-[14px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mt-1"
      >
        {status === "submitting" ? <Loader2 size={15} className="animate-spin" /> : null}
        {status === "submitting" ? "Sending…" : ctaLabel}
      </button>

      <style jsx global>{`
        .sfb-inquiry-field {
          width: 100%;
          height: 42px;
          border-radius: 8px;
          padding: 0 12px;
          font-size: 13.5px;
          outline: none;
          background: #111111;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f5f5f7;
        }
        textarea.sfb-inquiry-field {
          height: 80px;
          padding-top: 10px;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10.5px] uppercase tracking-wide text-white/40">{label}</label>
      {children}
    </div>
  );
}
