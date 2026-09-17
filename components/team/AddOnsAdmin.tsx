"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

type Product = { id: string; key: string; name: string; category: string; description: string; billing_type: string; base_price_cents: number; active: boolean; featured: boolean; stripe_price_id: string | null };
type CreditPackage = { id: string; name: string; credits: number; price_cents: number; active: boolean; stripe_price_id: string | null };
type ActionCost = { id: string; key: string; name: string; credit_cost: number; active: boolean };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function AddOnsAdmin({
  products,
  packages,
  actions,
  stripeConfigured,
}: {
  products: Product[];
  packages: CreditPackage[];
  actions: ActionCost[];
  stripeConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function patch(table: string, id: string, fields: Record<string, unknown>) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/team/billing/catalog", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, id, fields }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(null);
    }
  }

  async function syncStripe(table: "addon_products" | "credit_packages", id: string) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch("/api/team/billing/catalog/sync-stripe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table, id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error);
      setMsg("Synced to Stripe.");
      router.refresh();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1000px]">
      <div className="mb-2">
        <div className="text-[20px] font-semibold text-[#F5F5F7]">Add-Ons & Action Credits</div>
        <div className="text-[13px] text-[#6E6E73] mt-1">Manage the catalog customers see at /dashboard/billing. Changes apply immediately, no deployment needed.</div>
      </div>

      {!stripeConfigured && (
        <div className="my-4 rounded-[10px] p-3 text-[13px] flex items-center gap-2" style={{ background: "rgba(255,214,10,0.08)", color: "#FFD60A", border: "1px solid rgba(255,214,10,0.25)" }}>
          <AlertCircle size={15} />
          Stripe isn't connected yet (STRIPE_SECRET_KEY not set). Products/prices can be edited here, but "Sync to Stripe" and customer checkout won't work until it is.
        </div>
      )}
      {msg && <div className="my-3 text-[13px] text-[#A1A1A6]">{msg}</div>}

      <div className="text-[13px] font-semibold text-[#F5F5F7] mt-6 mb-3">Add-On Products</div>
      <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {products.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ background: "#0A0A0A", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] text-[#F5F5F7] truncate">{p.name}</div>
              <div className="text-[11px] text-[#6E6E73] uppercase">
                {p.category} · {p.billing_type === "recurring" ? "Recurring" : "One-Time"}
              </div>
            </div>
            <input
              type="number"
              defaultValue={(p.base_price_cents / 100).toFixed(2)}
              onBlur={(e) => {
                const cents = Math.round(parseFloat(e.target.value) * 100);
                if (!isNaN(cents) && cents !== p.base_price_cents) patch("addon_products", p.id, { base_price_cents: cents });
              }}
              className="w-[90px] h-[32px] rounded-[7px] px-2 text-[12.5px] text-right outline-none"
              style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <button
              onClick={() => patch("addon_products", p.id, { active: !p.active })}
              className="text-[11.5px] px-2.5 py-1 rounded-[6px]"
              style={{ background: p.active ? "rgba(48,209,88,0.12)" : "rgba(255,69,58,0.1)", color: p.active ? "#30D158" : "#FF6B6B" }}
            >
              {p.active ? "Active" : "Inactive"}
            </button>
            <button
              onClick={() => syncStripe("addon_products", p.id)}
              disabled={busy === p.id}
              className="h-[32px] px-3 rounded-[7px] text-[11.5px] flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.08)", color: "#A1A1A6" }}
            >
              {busy === p.id ? <Loader2 size={11} className="animate-spin" /> : p.stripe_price_id ? <CheckCircle2 size={11} color="#30D158" /> : <RefreshCw size={11} />}
              {p.stripe_price_id ? "Synced" : "Sync to Stripe"}
            </button>
          </div>
        ))}
      </div>

      <div className="text-[13px] font-semibold text-[#F5F5F7] mt-8 mb-3">Credit Packages</div>
      <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {packages.map((pkg, i) => (
          <div key={pkg.id} className="flex items-center gap-3 px-4 py-3" style={{ background: "#0A0A0A", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <div className="flex-1 min-w-0 text-[13px] text-[#F5F5F7]">
              {pkg.credits} credits — {pkg.name}
            </div>
            <input
              type="number"
              defaultValue={(pkg.price_cents / 100).toFixed(2)}
              onBlur={(e) => {
                const cents = Math.round(parseFloat(e.target.value) * 100);
                if (!isNaN(cents) && cents !== pkg.price_cents) patch("credit_packages", pkg.id, { price_cents: cents });
              }}
              className="w-[90px] h-[32px] rounded-[7px] px-2 text-[12.5px] text-right outline-none"
              style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <button
              onClick={() => syncStripe("credit_packages", pkg.id)}
              disabled={busy === pkg.id}
              className="h-[32px] px-3 rounded-[7px] text-[11.5px] flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.08)", color: "#A1A1A6" }}
            >
              {busy === pkg.id ? <Loader2 size={11} className="animate-spin" /> : pkg.stripe_price_id ? <CheckCircle2 size={11} color="#30D158" /> : <RefreshCw size={11} />}
              {pkg.stripe_price_id ? "Synced" : "Sync to Stripe"}
            </button>
          </div>
        ))}
      </div>

      <div className="text-[13px] font-semibold text-[#F5F5F7] mt-8 mb-3">Action Credit Costs</div>
      <div className="rounded-[12px] overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {actions.map((a, i) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3" style={{ background: "#0A0A0A", borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
            <div className="flex-1 min-w-0 text-[13px] text-[#F5F5F7]">{a.name}</div>
            <input
              type="number"
              defaultValue={a.credit_cost}
              onBlur={(e) => {
                const cost = parseInt(e.target.value, 10);
                if (!isNaN(cost) && cost !== a.credit_cost) patch("action_catalog", a.id, { credit_cost: cost });
              }}
              className="w-[70px] h-[32px] rounded-[7px] px-2 text-[12.5px] text-right outline-none"
              style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.08)", color: "#F5F5F7" }}
            />
            <span className="text-[11.5px] text-[#6E6E73] w-[45px]">credits</span>
          </div>
        ))}
      </div>
    </div>
  );
}
