"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Zap, MapPin, TrendingUp, Users, Sparkles } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import { trackMarketingEvent } from "@/lib/marketingEvents";

type Product = { id: string; key: string; name: string; category: string; description: string; best_for: string | null; billing_type: string; unit: string; base_price_cents: number; featured: boolean };
type CreditPackage = { id: string; name: string; credits: number; price_cents: number };

function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

const CATEGORY_LABEL: Record<string, string> = {
  SCALE: "Grow Your Coverage",
  INTELLIGENCE: "Get More Intelligence",
  EXECUTION: "Have SFB Do More",
  HUMAN_SERVICES: "Human Help",
  REPORTING: "Reporting",
  MULTI_LOCATION: "Grow Your Coverage",
  CREDITS: "Execution",
};

const CATEGORY_ORDER = ["SCALE", "MULTI_LOCATION", "INTELLIGENCE", "EXECUTION", "HUMAN_SERVICES", "REPORTING"];

// Illustrative event-based upsell examples for the marketing page ONLY --
// clearly labeled as examples, never presented as something detected for
// this visitor. The real, live version of this exists on the customer
// dashboard (Recommended For You), driven by actual account data.
const UPSELL_EXAMPLES = [
  { icon: MapPin, title: "Second location detected", body: "You have another location that isn't currently included in SFB monitoring.", cta: "Add Location", price: "$49/mo" },
  { icon: TrendingUp, title: "New market opportunity", body: "Your business serves Tampa, but Tampa isn't currently part of your monitored markets.", cta: "Add Tampa", price: "$39/mo" },
  { icon: Users, title: "Competitor detected", body: "A relevant competitor was identified outside your current monitoring allowance.", cta: "Add Competitor", price: "$15/mo" },
];

const CREDIT_ACTIONS = [
  { name: "Competitor Analysis", credits: 10 },
  { name: "Market Analysis", credits: 15 },
  { name: "Human Verification", credits: 15 },
  { name: "Content Brief", credits: 5 },
  { name: "Location Optimization", credits: 15 },
];

export default function ExpandSfbSectionClient({ products, packages }: { products: Product[]; packages: CreditPackage[] }) {
  const [showAll, setShowAll] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);

  const featured = useMemo(() => products.filter((p) => p.featured).slice(0, 6), [products]);
  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) (map[p.category] ||= []).push(p);
    return map;
  }, [products]);

  // "Build Your SFB" example -- Revenue Growth + a realistic combination of
  // real catalog prices. Clearly labeled EXAMPLE CONFIGURATION, not a
  // required purchase.
  // Fired once when this section actually renders -- a reasonable proxy
  // for "viewed" on a server-rendered page without wiring a full
  // viewport-intersection observer for a single marketing metric.
  useEffect(() => {
    trackMarketingEvent("credits_viewed");
  }, []);

  const additionalLocation = products.find((p) => p.key === "additional_location");
  const competitorPack = products.find((p) => p.key === "competitor_intelligence_pack");
  const marketExpansion = products.find((p) => p.key === "market_expansion");
  const exampleTotal = 197 + (additionalLocation?.base_price_cents ?? 0) / 100 + (competitorPack?.base_price_cents ?? 0) / 100 + (marketExpansion?.base_price_cents ?? 0) / 100;

  return (
    <section className="relative overflow-hidden section-band pt-24 md:pt-28 pb-24 md:pb-28">
      <div className="max-w-[1180px] mx-auto px-6">
        {/* EXPAND SFB header */}
        <Reveal>
          <div className="max-w-[780px] mx-auto text-center">
            <span className="inline-flex items-center h-[26px] px-[10px] rounded-full bg-[#151515] border border-white/[0.08] text-[9px] font-semibold tracking-[0.08em] text-white/[0.78]">
              EXPAND SFB
            </span>
            <h2 className="mt-[18px] text-[38px] sm:text-[50px] md:text-[58px] font-semibold leading-[0.98] tracking-[-0.05em] text-[#f7f7f7]">
              Your business grows.
              <br />
              SFB grows with it.
            </h2>
            <p className="max-w-[560px] mx-auto mt-[18px] text-[14px] leading-relaxed text-white/[0.42]">
              Start with the plan that fits how much help you want today. Add locations, markets, competitor
              intelligence, additional execution, and expert support whenever you need them.
            </p>
          </div>
        </Reveal>

        {/* Popular add-ons */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[16px] mt-14">
          {featured.map((p) => (
            <Reveal key={p.id}>
              <button
                onClick={() => {
                  trackMarketingEvent("addon_card_clicked", { key: p.key });
                  trackMarketingEvent("addon_detail_opened", { key: p.key });
                  setDetail(p);
                }}
                className="w-full text-left rounded-[18px] p-6 h-full flex flex-col transition-colors hover:border-white/[0.16]"
                style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/[0.4] mb-2">
                  {p.billing_type === "recurring" ? "FROM" : "ONE TIME"}
                </div>
                <div className="text-[20px] font-semibold text-white mb-2">{money(p.base_price_cents)}{p.billing_type === "recurring" ? "/mo" : ""}</div>
                <div className="text-[14px] font-medium text-white/[0.85] mb-1.5">{p.name}</div>
                <p className="text-[12.5px] leading-relaxed text-white/[0.42] flex-1">{p.description}</p>
                <span className="mt-4 text-[11.5px] font-semibold text-white/[0.8]">Learn more →</span>
              </button>
            </Reveal>
          ))}
        </div>

        <div className="text-center mt-8">
          <button
            onClick={() => {
              trackMarketingEvent("pricing_addons_viewed");
              setShowAll(true);
            }}
            className="h-[42px] px-6 rounded-full text-[12.5px] font-semibold"
            style={{ background: "#151515", border: "1px solid rgba(255,255,255,0.12)", color: "#f5f5f5" }}
          >
            View All Add-Ons
          </button>
        </div>

        {/* Action Credits */}
        <div className="mt-24 max-w-[900px] mx-auto">
          <Reveal>
            <div className="text-center mb-8">
              <span className="inline-flex items-center h-[26px] px-[10px] rounded-full bg-[#151515] border border-white/[0.08] text-[9px] font-semibold tracking-[0.08em] text-white/[0.78]">
                SFB ACTION CREDITS
              </span>
              <h3 className="mt-[16px] text-[30px] sm:text-[38px] font-semibold leading-[1.02] tracking-[-0.03em] text-[#f7f7f7]">
                Need SFB to do more?
                <br />
                Add execution without changing your plan.
              </h3>
              <p className="max-w-[520px] mx-auto mt-[14px] text-[13.5px] leading-relaxed text-white/[0.42]">
                Purchase additional SFB Action Credits whenever your business needs more analysis, optimization,
                verification, or execution beyond what's included in your plan.
              </p>
            </div>
          </Reveal>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {packages.map((pkg) => (
              <div key={pkg.id} className="rounded-[14px] p-4 text-center" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="text-[20px] font-semibold text-white">{pkg.credits}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-white/40 mb-2">Credits</div>
                <div className="text-[15px] font-medium text-white/80">{money(pkg.price_cents)}</div>
              </div>
            ))}
          </div>

          {/* Explain credits with the real 12/8/4 example */}
          <div className="mt-8 rounded-[18px] p-6" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} color="#42E36D" />
              <span className="text-[12px] font-semibold uppercase tracking-wide text-white/60">Your SFB Agent finds</span>
            </div>
            <div className="text-[15px] text-white/85 leading-relaxed">
              12 opportunities. <span className="text-white/50">8 are included with your current plan. 4 require additional execution.</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-2 mt-4">
              {CREDIT_ACTIONS.map((a) => (
                <div key={a.name} className="flex items-center justify-between text-[12.5px] text-white/50 px-3 py-2 rounded-[8px]" style={{ background: "#151515" }}>
                  <span>{a.name}</span>
                  <span className="flex items-center gap-1 text-white/70"><Zap size={11} color="#FFD60A" /> {a.credits}</span>
                </div>
              ))}
            </div>
            <div className="text-[11.5px] text-white/35 mt-4">
              Credits are service/action units, not money or an investment -- they pay for the specified SFB work, not a guaranteed outcome.
            </div>
          </div>
        </div>

        {/* Event-based upsell examples */}
        <div className="mt-24">
          <Reveal>
            <div className="text-center mb-8">
              <h3 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.03em] text-[#f7f7f7]">
                SFB tells you when expansion actually makes sense.
              </h3>
              <p className="max-w-[520px] mx-auto mt-2 text-[12.5px] text-white/[0.4]">Illustrative examples of what a real account might see -- not something detected for you here.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-4">
            {UPSELL_EXAMPLES.map((ex) => (
              <div key={ex.title} className="rounded-[16px] p-5" style={{ background: "rgba(255,214,10,0.05)", border: "1px solid rgba(255,214,10,0.16)" }}>
                <ex.icon size={16} color="#FFD60A" className="mb-2.5" />
                <div className="text-[13.5px] font-semibold text-white mb-1.5">{ex.title}</div>
                <p className="text-[12px] text-white/50 leading-relaxed mb-3">{ex.body}</p>
                <div className="text-[11.5px] font-semibold text-[#FFD60A]">{ex.cta} — {ex.price}</div>
              </div>
            ))}
          </div>
          <div className="text-center text-[10.5px] uppercase tracking-wide text-white/[0.3] mt-4">Example configuration</div>
        </div>

        {/* Multi-location */}
        <div className="mt-24 max-w-[720px] mx-auto text-center">
          <Reveal>
            <h3 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.03em] text-[#f7f7f7]">Built to grow past one location.</h3>
            <p className="mt-3 text-[13.5px] leading-relaxed text-white/[0.42]">
              One business. Five locations. Twenty locations. Hundreds later. SFB's architecture can expand business
              intelligence and eligible monitoring across additional locations as you grow.
            </p>
            <Link
              href="#book-a-demo"
              onClick={() => trackMarketingEvent("multi_location_clicked")}
              className="inline-flex items-center h-[42px] px-6 mt-5 rounded-full text-[12.5px] font-semibold"
              style={{ background: "#f5f5f5", color: "#090909" }}
            >
              Explore Multi-Location
            </Link>
          </Reveal>
        </div>

        {/* Plan + add-on example */}
        <div className="mt-24 max-w-[440px] mx-auto">
          <Reveal>
            <div className="text-[10.5px] uppercase tracking-wide text-white/[0.4] text-center mb-3">Example Configuration</div>
            <div className="rounded-[18px] p-6" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="text-[14px] font-semibold text-white mb-3">Build Your SFB</div>
              {[
                ["Revenue Growth", "$197/mo"],
                [additionalLocation?.name ?? "Additional Location", money(additionalLocation?.base_price_cents ?? 4900) + "/mo"],
                [competitorPack?.name ?? "Competitor Intelligence", money(competitorPack?.base_price_cents ?? 4900) + "/mo"],
                [marketExpansion?.name ?? "Market Expansion", money(marketExpansion?.base_price_cents ?? 3900) + "/mo"],
              ].map(([label, price]) => (
                <div key={label} className="flex items-center justify-between py-1.5 text-[13px] text-white/60">
                  <span>{label}</span>
                  <span>{price}</span>
                </div>
              ))}
              <div className="flex items-center justify-between mt-3 pt-3 text-[16px] font-semibold text-white" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <span>Total</span>
                <span>${exampleTotal.toFixed(2)}/mo</span>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Plan positioning notes */}
        <div className="grid sm:grid-cols-3 gap-4 mt-16 max-w-[980px] mx-auto text-center">
          <div className="rounded-[14px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[12.5px] font-semibold text-white/80 mb-1">Presence stands on its own</div>
            <p className="text-[11.5px] text-white/40 leading-relaxed">Start with SFB intelligence and monitoring. Expand only when needed.</p>
          </div>
          <div className="rounded-[14px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[12.5px] font-semibold text-white/80 mb-1">Growth is built to expand</div>
            <p className="text-[11.5px] text-white/40 leading-relaxed">SFB finds opportunities. Add-ons expand how far SFB can go for you.</p>
          </div>
          <div className="rounded-[14px] p-4" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[12.5px] font-semibold text-white/80 mb-1">Dominance already manages it</div>
            <p className="text-[11.5px] text-white/40 leading-relaxed">Add-ons are primarily for additional scale, locations, markets, or specialized services.</p>
          </div>
        </div>
      </div>

      {/* View All Add-Ons drawer */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setShowAll(false)}>
          <div className="h-full overflow-y-auto p-7 w-full max-w-[480px]" style={{ background: "#0B0B0B", borderLeft: "1px solid rgba(255,255,255,0.08)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="text-[16px] font-semibold text-white">All Add-Ons</div>
              <button onClick={() => setShowAll(false)} className="text-white/50 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-7">
              {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
                <div key={category}>
                  <div className="text-[12px] font-semibold uppercase tracking-wide text-white/50 mb-2.5">{CATEGORY_LABEL[category]}</div>
                  <div className="flex flex-col gap-2">
                    {grouped[category].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          trackMarketingEvent("addon_detail_opened", { key: p.key });
                          setDetail(p);
                        }}
                        className="w-full text-left flex items-center justify-between px-3.5 py-3 rounded-[10px]"
                        style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.06)" }}
                      >
                        <span className="text-[13px] text-white/85">{p.name}</span>
                        <span className="text-[12.5px] text-white/45">
                          {money(p.base_price_cents)}
                          {p.billing_type === "recurring" ? "/mo" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add-on detail modal */}
      {detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setDetail(null)}>
          <div className="w-full max-w-[420px] rounded-[18px] p-6" style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[16px] font-semibold text-white">{detail.name}</div>
              <button onClick={() => setDetail(null)} className="text-white/50 hover:text-white">
                <X size={17} />
              </button>
            </div>
            <div className="text-[22px] font-semibold text-white mb-3">
              {money(detail.base_price_cents)}
              {detail.billing_type === "recurring" ? <span className="text-[13px] text-white/40"> /month</span> : <span className="text-[13px] text-white/40"> one-time</span>}
            </div>
            <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">What SFB does</div>
            <p className="text-[13.5px] text-white/70 leading-relaxed mb-3">{detail.description}</p>
            {detail.best_for && (
              <>
                <div className="text-[11px] uppercase tracking-wide text-white/40 mb-1.5">Best for</div>
                <p className="text-[13px] text-white/60 mb-4">{detail.best_for}</p>
              </>
            )}
            <Link
              href="/login?next=/dashboard/billing"
              onClick={() => trackMarketingEvent("addon_cta_clicked", { key: detail.key })}
              className="w-full h-[44px] rounded-[10px] bg-white text-black text-[13.5px] font-semibold flex items-center justify-center"
            >
              Existing customer? Add this
            </Link>
            <Link
              href="#book-a-demo"
              onClick={() => {
                trackMarketingEvent("demo_started_from_addon", { key: detail.key });
                setDetail(null);
              }}
              className="w-full h-[40px] mt-2 rounded-[10px] text-[13px] text-white/60 flex items-center justify-center"
              style={{ border: "1px solid rgba(255,255,255,0.1)" }}
            >
              New here? Book a Demo
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
