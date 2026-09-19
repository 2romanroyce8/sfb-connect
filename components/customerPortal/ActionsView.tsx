"use client";

import { useState } from "react";
import type { RecommendationItem, CatalogAction, ReservationItem, CreditLedgerEntry } from "@/lib/customerPortal/actions";

const PRIORITY_STYLE: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-neutral-50 text-neutral-500 border-neutral-200",
};

export default function ActionsView({
  recommendations,
  catalogActions,
  reservations,
  creditHistory,
  creditSummary,
  creditPackages,
}: {
  recommendations: RecommendationItem[];
  catalogActions: CatalogAction[];
  reservations: ReservationItem[];
  creditHistory: CreditLedgerEntry[];
  creditSummary: { settled: number; available: number; reserved: number };
  creditPackages: { id: string; name: string; credits: number; price_cents: number }[];
}) {
  const [requesting, setRequesting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  async function requestAction(actionCatalogId: string) {
    setRequesting(actionCatalogId);
    setMessage(null);
    try {
      const res = await fetch("/api/dashboard/actions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionCatalogId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not request this action.");
      setMessage("Requested -- SFB will complete this and notify you.");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not request this action.");
    } finally {
      setRequesting(null);
    }
  }

  async function buyCredits(packageId: string) {
    setBuying(true);
    try {
      const res = await fetch("/api/dashboard/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "credits", creditPackageId: packageId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Could not start checkout.");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not start checkout.");
      setBuying(false);
    }
  }

  return (
    <div>
      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Recommended For You</h2>
        {recommendations.filter((r) => r.status !== "done").length === 0 ? (
          <div className="border border-neutral-200 rounded-xl p-6 text-[13px] text-neutral-500">No open recommendations right now.</div>
        ) : (
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {recommendations
              .filter((r) => r.status !== "done")
              .map((r) => (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-[13px] font-medium text-neutral-900">{r.title}</div>
                    <span className={`shrink-0 text-[10.5px] font-medium rounded-full px-2 py-0.5 border ${PRIORITY_STYLE[r.priority]}`}>{r.priority}</span>
                  </div>
                  {r.description && <div className="text-[12.5px] text-neutral-500 mt-1">{r.description}</div>}
                  <div className="text-[11px] text-neutral-400 mt-1.5">{r.status === "in_progress" ? "In progress" : "Pending"}</div>
                </div>
              ))}
          </div>
        )}
      </section>

      {reservations.filter((r) => r.status === "RESERVED" || r.status === "EXECUTING").length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">In Progress</h2>
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {reservations
              .filter((r) => r.status === "RESERVED" || r.status === "EXECUTING")
              .map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <div className="text-[13px] text-neutral-900">{r.actionName}</div>
                  <span className="text-[10.5px] font-medium rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200">
                    {r.status === "EXECUTING" ? "Running" : "Requested"}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Available Actions</h2>
        {message && <div className="text-[12.5px] text-neutral-600 mb-3">{message}</div>}
        <div className="grid sm:grid-cols-2 gap-3">
          {catalogActions.map((a) => (
            <div key={a.id} className="border border-neutral-200 rounded-xl p-4 flex flex-col justify-between">
              <div>
                <div className="text-[13px] font-medium text-neutral-900">{a.name}</div>
                {a.description && <div className="text-[12px] text-neutral-500 mt-1">{a.description}</div>}
              </div>
              <div className="flex items-center justify-between mt-4">
                <span className="text-[12px] text-neutral-500">{a.creditCost} credits</span>
                <button
                  onClick={() => requestAction(a.id)}
                  disabled={!a.affordable || requesting === a.id}
                  className="h-8 px-3 rounded-full bg-neutral-900 text-white text-[12px] font-medium disabled:opacity-40"
                >
                  {requesting === a.id ? "Requesting..." : a.affordable ? "Request" : "Not enough credits"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {reservations.filter((r) => r.status === "COMPLETED").length > 0 && (
        <section className="mb-8">
          <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Completed</h2>
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {reservations
              .filter((r) => r.status === "COMPLETED")
              .map((r) => (
                <div key={r.id} className="p-4 flex items-center justify-between">
                  <div className="text-[13px] text-neutral-900">{r.actionName}</div>
                  <span className="text-[11px] text-neutral-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="mb-8">
        <h2 className="text-[13px] font-semibold text-neutral-900 mb-3">Action Credits</h2>
        <div className="border border-neutral-200 rounded-xl p-5 grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-[10.5px] uppercase text-neutral-400 mb-1">Available</div>
            <div className="text-[20px] font-semibold text-neutral-900">{creditSummary.available}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase text-neutral-400 mb-1">Reserved</div>
            <div className="text-[20px] font-semibold text-neutral-900">{creditSummary.reserved}</div>
          </div>
          <div>
            <div className="text-[10.5px] uppercase text-neutral-400 mb-1">Settled</div>
            <div className="text-[20px] font-semibold text-neutral-900">{creditSummary.settled}</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {creditPackages.map((p) => (
            <button
              key={p.id}
              onClick={() => buyCredits(p.id)}
              disabled={buying}
              className="h-9 px-4 rounded-full border border-neutral-200 text-[12.5px] font-medium disabled:opacity-40"
            >
              {p.credits} credits -- ${(p.price_cents / 100).toFixed(0)}
            </button>
          ))}
        </div>

        <div className="text-[11.5px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">Credit History</div>
        {creditHistory.length === 0 ? (
          <div className="text-[13px] text-neutral-500">No credit activity yet.</div>
        ) : (
          <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
            {creditHistory.map((h) => (
              <div key={h.id} className="p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[12.5px] text-neutral-900">{h.description || h.type}</div>
                  <div className="text-[11px] text-neutral-400">{new Date(h.createdAt).toLocaleDateString()}</div>
                </div>
                <span className={`text-[12.5px] font-medium ${h.amount > 0 ? "text-emerald-600" : "text-neutral-600"}`}>
                  {h.amount > 0 ? "+" : ""}
                  {h.amount}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
