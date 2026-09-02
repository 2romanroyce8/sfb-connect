"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentReviewControls({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"confirm" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "confirm" | "reject") {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Request failed.");
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mt-3">
      {!showReject ? (
        <div className="flex items-center gap-3">
          <button
            onClick={() => act("confirm")}
            disabled={!!loading}
            className="bg-white text-black px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-40"
          >
            {loading === "confirm" ? "Confirming…" : "Confirm Payment"}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={!!loading}
            className="text-sm text-red-400 hover:text-red-300"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            placeholder="Rejection reason (shown to customer)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm outline-none"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => act("reject")}
              disabled={!!loading}
              className="bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              {loading === "reject" ? "Rejecting…" : "Confirm Rejection"}
            </button>
            <button onClick={() => setShowReject(false)} className="text-sm text-medium-gray">
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
