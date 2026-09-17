"use client";

import { useState } from "react";
import { Loader2, Zap, Sparkles, CheckCircle2 } from "lucide-react";

type Entitlements = { planKey: string | null; locationAllowance: number; marketAllowance: number; competitorAllowance: number; queryAllowance: number; creditBalance: number; activeAddonKeys: string[] };
type ActiveAddon = { id: string; quantity: number; status: string; current_period_end: string | null; addon_products: { key: string; name: string; base_price_cents: number; unit: string } | null; stripe_subscription_id?: string | null };
type Purchase = { id: string; purchase_type: string; quantity: number; amount_cents: number; status: string; created_at: string; addon_products: { name: string } | null; credit_packages: { name: string } | null };
type Product = { id: string; key: string; name: string; category: string; description: string; best_for: string | null; billing_type: string; unit: string; base_price_cents: number; featured: boolean };
type CreditPackage = { id: string; name: string; credits: number; price_cents: number };
type Opportunity = { id: string; type: string; evidence: unknown; status: string; addon_products: { id: string; name: string; base_price_cents: number } | null };

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const CATEGORY_LABEL: Record<string, string> = {
  SCALE: "Grow Your Coverage",
  INTELLIGENCE: "Get More Intelligence",
  EXECUTION: "Have SFB Do More",
  HUMAN_SERVICES: "Human Help",
  REPORTING: "Reporting",
  MULTI_LOCATION: "Multi-Location",
  CREDITS: "Action Credits",
};

const OPPORTUNITY_COPY: Record<string, (evidence: any) => { title: string; body: string }> = {
  second_location: () => ({ title: "Second location detected", body: "We found another business location that isn't currently included in your monitoring." }),
  new_market: (e) => ({ title: "New market opportunity", body: `Your business serves ${e?.city || "a nearby area"}, but it isn't currently part of your monitored markets.` }),
  competitor_detected: (e) => ({ title: "Competitor detected", body: `${e?.name || "A relevant competitor"} was identified outside your current monitoring allowance.` }),
  knowledge_conflicts: (e) => ({ title: "Business-information conflicts detected", body: `${e?.count || "Several"} conflicts require additional managed cleanup.` }),
};

export default function BillingDashboard({
  businessName,
  planLabel,
  planPriceCents,
  estimatedMonthlyTotalCents,
  entitlements,
  activeAddons,
  purchases,
  allProducts,
  creditPackages,
  opportunities,
}: {
  businessName: string | null;
  planLabel: string;
  planPriceCents: number | null;
  estimatedMonthlyTotalCents: number;
  entitlements: Entitlements;
  activeAddons: ActiveAddon[];
  purchases: Purchase[];
  allProducts: Product[];
  creditPackages: CreditPackage[];
  opportunities: Opportunity[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buyAddon(productId: string, quantity = 1) {
    setBusyId(productId);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "addon", addonProductId: productId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Could not start checkout.");
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusyId(null);
    }
  }

  async function cancelAddon(customerAddonId: string) {
    if (!confirm("Cancel this add-on at the end of the current billing period?")) return;
    setBusyId(customerAddonId);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/billing/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerAddonId }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Could not cancel.");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel.");
      setBusyId(null);
    }
  }

  async function buyCredits(packageId: string) {
    setBusyId(packageId);
    setError(null);
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
      setError(err instanceof Error ? err.message : "Could not start checkout.");
      setBusyId(null);
    }
  }

  const grouped = allProducts.reduce<Record<string, Product[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div style={{ minHeight: "100vh", background: "#0B0B0B", color: "#F5F5F7" }} className="px-6 md:px-10 py-10 max-w-[1100px] mx-auto">
      <div className="mb-8">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-1">SFB Connect</div>
        <div className="text-[26px] font-semibold">{businessName || "Your Account"}</div>
      </div>

      {error && (
        <div className="mb-6 rounded-[10px] p-3 text-[13px]" style={{ background: "rgba(255,69,58,0.08)", color: "#FF6B6B", border: "1px solid rgba(255,69,58,0.2)" }}>
          {error}
        </div>
      )}

      {/* YOUR PLAN */}
      <section className="mb-8">
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Your Plan</div>
        <div className="rounded-[16px] p-5 flex items-center justify-between" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div>
            <div className="text-[18px] font-semibold">{planLabel}</div>
            {planPriceCents != null && <div className="text-[13px] text-white/50 mt-0.5">{money(planPriceCents)}/month</div>}
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold">{money(estimatedMonthlyTotalCents)}</div>
            <div className="text-[11px] uppercase tracking-wide text-white/40">Estimated Monthly Total</div>
          </div>
        </div>
      </section>

      {/* ACTIVE ADD-ONS + ACTION CREDITS */}
      <div className="grid md:grid-cols-2 gap-5 mb-8">
        <section>
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Active Add-Ons</div>
          <div className="rounded-[16px] p-5" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
            {activeAddons.length === 0 ? (
              <div className="text-[13.5px] text-white/50">No active add-ons yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeAddons.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13.5px] truncate">
                        {a.quantity > 1 ? `${a.quantity}x ` : ""}
                        {a.addon_products?.name}
                      </div>
                      {a.current_period_end && <div className="text-[11px] text-white/40">Active until {new Date(a.current_period_end).toLocaleDateString()}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[13px] text-white/50">{a.addon_products ? money(a.addon_products.base_price_cents * a.quantity) + "/mo" : ""}</span>
                      <button onClick={() => cancelAddon(a.id)} disabled={busyId === a.id} className="text-[11px] text-white/40 hover:text-white underline disabled:opacity-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Action Credits</div>
          <div className="rounded-[16px] p-5" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} color="#FFD60A" />
              <span className="text-[22px] font-semibold">{entitlements.creditBalance}</span>
              <span className="text-[13px] text-white/50">available</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {creditPackages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => buyCredits(pkg.id)}
                  disabled={busyId === pkg.id}
                  className="h-[42px] rounded-[9px] text-[12.5px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-60"
                  style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  {busyId === pkg.id ? <Loader2 size={12} className="animate-spin" /> : null}
                  {pkg.credits} for {money(pkg.price_cents)}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* RECOMMENDED FOR YOU -- only real, detected opportunities */}
      {opportunities.length > 0 && (
        <section className="mb-8">
          <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Recommended For You</div>
          <div className="flex flex-col gap-2.5">
            {opportunities.map((op) => {
              const copy = OPPORTUNITY_COPY[op.type]?.(op.evidence) || { title: "Expansion opportunity detected", body: "SFB found something worth reviewing." };
              return (
                <div key={op.id} className="rounded-[14px] p-4 flex items-center justify-between gap-4" style={{ background: "rgba(255,214,10,0.06)", border: "1px solid rgba(255,214,10,0.2)" }}>
                  <div>
                    <div className="text-[13.5px] font-semibold flex items-center gap-1.5">
                      <Sparkles size={13} color="#FFD60A" /> {copy.title}
                    </div>
                    <div className="text-[12.5px] text-white/60 mt-0.5">{copy.body}</div>
                  </div>
                  {op.addon_products && (
                    <button
                      onClick={() => buyAddon(op.addon_products!.id)}
                      disabled={busyId === op.addon_products.id}
                      className="h-[36px] px-4 shrink-0 rounded-[8px] text-[12.5px] font-semibold"
                      style={{ background: "#FFD60A", color: "#111111" }}
                    >
                      Add — {money(op.addon_products.base_price_cents)}{op.addon_products.base_price_cents ? "/mo" : ""}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ALL ADD-ONS, by category */}
      <section className="mb-8">
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-3">All Add-Ons</div>
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([category, products]) => (
            <div key={category}>
              <div className="text-[13px] font-semibold text-white/70 mb-2.5">{CATEGORY_LABEL[category] || category}</div>
              <div className="grid md:grid-cols-2 gap-3">
                {products.map((p) => {
                  const alreadyActive = entitlements.activeAddonKeys.includes(p.key);
                  return (
                    <div key={p.id} className="rounded-[14px] p-4" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[14px] font-semibold">{p.name}</div>
                        <div className="text-[13px] text-white/50 shrink-0">
                          {money(p.base_price_cents)}
                          {p.billing_type === "recurring" ? "/mo" : ""}
                        </div>
                      </div>
                      <p className="text-[12.5px] text-white/55 leading-relaxed mt-1.5">{p.description}</p>
                      <button
                        onClick={() => buyAddon(p.id)}
                        disabled={busyId === p.id}
                        className="w-full h-[36px] mt-3 rounded-[8px] text-[12.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
                        style={{ background: alreadyActive ? "#1A1A1A" : "#F5F5F7", color: alreadyActive ? "#8E8E93" : "#111111", border: alreadyActive ? "1px solid rgba(255,255,255,0.08)" : "none" }}
                      >
                        {busyId === p.id ? <Loader2 size={12} className="animate-spin" /> : alreadyActive ? <CheckCircle2 size={12} /> : null}
                        {alreadyActive ? "Active" : p.billing_type === "recurring" ? "Add to Plan" : "Purchase"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PURCHASE HISTORY */}
      <section>
        <div className="text-[11px] uppercase tracking-wide text-white/40 mb-2">Purchase History</div>
        <div className="rounded-[14px] overflow-hidden" style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)" }}>
          {purchases.length === 0 ? (
            <div className="p-5 text-[13.5px] text-white/50">No purchases yet.</div>
          ) : (
            purchases.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3" style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                <div>
                  <div className="text-[13px]">{p.addon_products?.name || p.credit_packages?.name || p.purchase_type}</div>
                  <div className="text-[11.5px] text-white/40 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px]">{money(p.amount_cents)}</span>
                  <span
                    className="text-[10.5px] uppercase tracking-wide px-2 py-0.5 rounded-[5px]"
                    style={{ color: p.status === "completed" ? "#30D158" : p.status === "failed" ? "#FF6B6B" : p.status === "refunded" ? "#FFD60A" : "#8E8E93", border: "1px solid currentColor" }}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
