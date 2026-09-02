"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Payment,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
} from "@/lib/types";

const METHODS: PaymentMethod[] = ["cashapp", "paypal", "zelle"];

const METHOD_HINT: Record<PaymentMethod, string> = {
  cashapp: "Send the Cash App payment as usual, then paste your reference code into the payment note.",
  paypal: "Send via PayPal (Friends & Family or Goods & Services), including the reference code in the note.",
  zelle: "Send via Zelle from your bank app, including the reference code in the memo/note field.",
};

export default function PayFlow({
  initialPayment,
  contacts,
  amountDisplay,
}: {
  initialPayment: Payment | null;
  contacts: Record<PaymentMethod, string>;
  amountDisplay: string;
}) {
  const router = useRouter();
  const [payment, setPayment] = useState<Payment | null>(initialPayment);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("cashapp");
  const [note, setNote] = useState(payment?.customer_note || "");
  const [proofUrl, setProofUrl] = useState(payment?.proof_screenshot_url || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function startPayment() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: selectedMethod }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not start payment.");
      }
      const { payment: created } = await res.json();
      setPayment(created);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitProof() {
    if (!payment) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerNote: note, proofScreenshotUrl: proofUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Could not submit proof.");
      }
      setSaved(true);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resubmit() {
    setPayment(null);
    setNote("");
    setProofUrl("");
    setSaved(false);
  }

  // ---- No payment yet: choose method ----
  if (!payment) {
    return (
      <div>
        <div className="grid grid-cols-3 gap-3 mb-8">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMethod(m)}
              className={`rounded-2xl border px-4 py-5 text-sm font-semibold transition-colors ${
                selectedMethod === m
                  ? "bg-white text-black border-white"
                  : "border-white/10 text-medium-gray hover:border-white/30"
              }`}
            >
              {PAYMENT_METHOD_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="text-sm text-medium-gray mb-6">{METHOD_HINT[selectedMethod]}</p>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        <button
          onClick={startPayment}
          disabled={loading}
          className="bg-white text-black px-7 py-3.5 rounded-full text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-60"
        >
          {loading ? "Preparing…" : `Pay with ${PAYMENT_METHOD_LABELS[selectedMethod]} — ${amountDisplay}`}
        </button>
      </div>
    );
  }

  // ---- Rejected: allow resubmission ----
  if (payment.status === "rejected") {
    return (
      <div>
        <div className="rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 mb-6 text-sm">
          <div className="font-semibold text-red-300 mb-1">This submission couldn&apos;t be confirmed</div>
          <div className="text-red-200/80">
            {payment.rejection_reason || "We couldn't match this payment. Please try again or contact support."}
          </div>
        </div>
        <button
          onClick={resubmit}
          className="bg-white text-black px-7 py-3.5 rounded-full text-sm font-semibold hover:scale-[1.02] transition-transform"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ---- Confirmed: proceed to onboarding ----
  if (payment.status === "confirmed") {
    return (
      <div>
        <div className="rounded-2xl border border-green-400/30 bg-green-400/10 px-5 py-4 mb-6 text-sm">
          <div className="font-semibold text-green-300 mb-1">Payment confirmed</div>
          <div className="text-green-200/80">
            Your {PAYMENT_METHOD_LABELS[payment.method]} payment has been verified. You&apos;re ready to start your AI Presence intake.
          </div>
        </div>
        <Link
          href="/onboarding"
          className="bg-white text-black px-7 py-3.5 rounded-full text-sm font-semibold inline-block hover:scale-[1.02] transition-transform"
        >
          Continue to Onboarding →
        </Link>
      </div>
    );
  }

  // ---- Pending review: show instructions + reference code + proof form ----
  return (
    <div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-5 mb-6">
        <div className="text-[12px] font-mono uppercase text-medium-gray mb-2">
          Pay via {PAYMENT_METHOD_LABELS[payment.method]}
        </div>
        <div className="text-lg font-semibold mb-1">{contacts[payment.method]}</div>
        <div className="text-sm text-medium-gray mb-4">Amount: {amountDisplay}</div>
        <div className="text-[12px] font-mono uppercase text-medium-gray mb-2">
          Include this reference code in your payment note
        </div>
        <div className="font-mono text-2xl font-semibold tracking-wide bg-white/10 rounded-xl px-4 py-3 inline-block">
          {payment.reference_code}
        </div>
      </div>

      <p className="text-sm text-medium-gray mb-6">{METHOD_HINT[payment.method]}</p>

      <div className="flex flex-col gap-3 mb-6">
        <label className="flex flex-col gap-2">
          <span className="text-[13px] text-medium-gray">Note (optional — transaction ID, timing, etc.)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40 resize-none"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[13px] text-medium-gray">Screenshot link (optional)</span>
          <input
            value={proofUrl}
            onChange={(e) => setProofUrl(e.target.value)}
            placeholder="Link to a screenshot of the payment"
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-white/40"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
      {saved && <p className="text-sm text-green-400 mb-4">Saved — your submission is queued for review.</p>}

      <button
        onClick={submitProof}
        disabled={loading}
        className="bg-white text-black px-7 py-3.5 rounded-full text-sm font-semibold hover:scale-[1.02] transition-transform disabled:opacity-60"
      >
        {loading ? "Saving…" : "I've Sent Payment — Submit for Review"}
      </button>

      <p className="text-sm text-medium-gray mt-6">
        Payments are typically reviewed within a few hours. You&apos;ll be able to
        continue to onboarding as soon as it&apos;s confirmed — check back on
        this page.
      </p>
    </div>
  );
}
