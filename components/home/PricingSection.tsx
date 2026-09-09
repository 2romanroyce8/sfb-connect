"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Star } from "lucide-react";
import Reveal from "@/components/ui/Reveal";
import ServiceInquiryForm from "@/components/marketing/ServiceInquiryForm";

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  description: string;
  button: string;
  href: string;
  buttonStyle: "dark" | "light";
  accent: string;
  badge?: string;
  featured?: boolean;
  features: string[];
};

const YEARLY_DISCOUNT = 0.2; // 20% off when billed annually

const PLANS: Plan[] = [
  {
    id: "monitor",
    name: "AI Presence Monitor",
    monthlyPrice: 19.99,
    description:
      "SFB Connects tells you what's happening and what to improve — self-service AI presence monitoring.",
    button: "Book a Demo",
    href: "#book-a-demo",
    buttonStyle: "dark",
    accent: "#5577FF",
    features: [
      "AI Presence Score",
      "Business knowledge profile",
      "AI visibility monitoring",
      "Issue detection",
      "Competitor comparison",
      "Monthly report",
    ],
  },
  {
    id: "grow",
    name: "AI Presence Grow",
    monthlyPrice: 197,
    description:
      "SFB Connects actively improves your AI presence — not just reports, real optimization work.",
    button: "Book a Demo",
    href: "#book-a-demo",
    buttonStyle: "light",
    accent: "#FFFFFF",
    badge: "POPULAR",
    featured: true,
    features: [
      "Everything in Monitor",
      "Automated optimization",
      "Structured data implementation",
      "AI query tracking",
      "Competitive intelligence",
      "Priority support",
    ],
  },
  {
    id: "managed",
    name: "AI Presence Managed",
    monthlyPrice: 269,
    description:
      "SFB Connects and a dedicated specialist manage your AI presence for you, end to end.",
    button: "Book a Demo",
    href: "#book-a-demo",
    buttonStyle: "dark",
    accent: "#42E36D",
    features: [
      "Everything in Grow",
      "Human oversight",
      "White-glove onboarding",
      "Monthly strategy review",
      "Business-specific testing",
      "Priority fixes",
    ],
  },
];

function formatPrice(n: number) {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? `$${rounded}` : `$${rounded.toFixed(2)}`;
}

function PlanCard({ plan, index, billing }: { plan: Plan; index: number; billing: "monthly" | "yearly" }) {
  const annualTotal = Math.round(plan.monthlyPrice * 12 * (1 - YEARLY_DISCOUNT) * 100) / 100;
  const yearlyPerMonth = annualTotal / 12;
  const displayPrice = billing === "monthly" ? plan.monthlyPrice : yearlyPerMonth;

  return (
    <Reveal className="h-full">
      <div
        className="relative h-full flex flex-col rounded-[12px] overflow-hidden border p-7 transition-transform duration-200 hover:-translate-y-1"
        style={{
          borderColor: plan.featured
            ? "rgba(255,255,255,0.30)"
            : "rgba(255,255,255,0.09)",
          background: plan.featured
            ? "linear-gradient(180deg, rgba(42,42,44,0.98) 0%, rgba(16,16,17,1) 100%)"
            : "linear-gradient(180deg, rgba(28,28,30,0.96) 0%, rgba(15,15,16,0.98) 100%)",
          boxShadow: plan.featured
            ? "0 30px 90px rgba(0,0,0,0.42)"
            : "0 28px 70px rgba(0,0,0,0.34)",
        }}
      >
        {/* Ambient corner light */}
        <div
          className="absolute -top-[70px] -left-10 w-[230px] h-[190px] rounded-full pointer-events-none"
          style={{
            background: plan.accent,
            filter: "blur(44px)",
            opacity: 0.22,
          }}
        />
        {/* Decorative circle */}
        <div className="absolute -top-1.5 -right-7 w-[126px] h-[126px] rounded-full border border-white/[0.035] bg-white/[0.012]" />

        {plan.badge && (
          <span className="absolute top-6 right-6 h-6 px-[9px] inline-flex items-center gap-[5px] rounded-full bg-[#2c2c2e] border border-white/10 text-[8px] font-semibold tracking-[0.05em] text-white/70 z-10">
            <Star size={9} className="fill-white/70" />
            {plan.badge}
          </span>
        )}

        <div className="relative z-10 flex flex-col h-full">
          <div
            className="w-[22px] h-[22px] rounded-[5px] mb-[22px]"
            style={{
              background: plan.accent,
              border: "1px solid rgba(255,255,255,0.38)",
              boxShadow: `0 0 18px ${plan.accent}`,
            }}
          />

          <div className="text-[18px] font-medium tracking-[-0.025em] text-[#f4f4f4]">
            {plan.name}
          </div>

          <div className="flex items-baseline gap-1 mt-5">
            <span className="text-[40px] font-medium tracking-[-0.05em] leading-none text-white">
              {formatPrice(displayPrice)}
            </span>
            <span className="text-[13px] text-white/[0.36]">/mo</span>
          </div>
          <div className="mt-1.5 h-[15px]">
            {billing === "yearly" && (
              <span className="text-[10.5px] text-white/[0.34]">
                Billed {formatPrice(annualTotal)}/yr
              </span>
            )}
          </div>

          <p className="mt-[10px] min-h-[62px] text-[13px] leading-relaxed text-white/[0.42]">
            {plan.description}
          </p>

          <Link
            href={plan.href}
            className="block w-full h-[42px] mt-[22px] rounded-[5px] text-[11px] font-semibold flex items-center justify-center transition-transform hover:scale-[1.02]"
            style={
              plan.buttonStyle === "light"
                ? { background: "#f5f5f5", color: "#090909" }
                : {
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#ffffff",
                  }
            }
          >
            {plan.button}
          </Link>

          <div className="flex items-center gap-3 mt-[30px]">
            <span className="h-px flex-1 bg-white/[0.07]" />
            <span className="text-[8px] font-medium tracking-[0.08em] text-white/[0.28]">
              STAND OUT FEATURES
            </span>
            <span className="h-px flex-1 bg-white/[0.07]" />
          </div>

          <div className="flex flex-col gap-3 mt-5">
            {plan.features.map((f) => (
              <div
                key={f}
                className="flex items-center gap-[9px] text-[11px] leading-[1.4] text-white/[0.58]"
              >
                <Check
                  size={13}
                  strokeWidth={1.7}
                  className="text-white/[0.48] shrink-0"
                />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");

  return (
    <section className="relative overflow-hidden section-band pt-24 md:pt-32 pb-24 md:pb-32" id="pricing">
      <div className="max-w-[1180px] mx-auto px-6">
        <Reveal>
          <div className="max-w-[780px] mx-auto text-center">
            <span className="inline-flex items-center h-[26px] px-[10px] rounded-full bg-[#151515] border border-white/[0.08] text-[9px] font-semibold tracking-[0.08em] text-white/[0.78]">
              PRICING
            </span>
            <h2 className="mt-[18px] text-[42px] sm:text-[56px] md:text-[68px] font-semibold leading-[0.98] tracking-[-0.05em] text-[#f7f7f7]">
              Plans and Pricing
            </h2>
            <p className="max-w-[560px] mx-auto mt-[18px] text-[14px] leading-relaxed text-white/[0.42]">
              Choose the plan that fits where your business is today and how
              far you want to take your AI presence.
            </p>

            <div className="inline-flex items-center gap-1 mt-7 p-[4px] rounded-full bg-[#121212] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setBilling("monthly")}
                className="h-8 px-4 rounded-full text-[11.5px] font-medium transition-colors"
                style={
                  billing === "monthly"
                    ? { background: "#f5f5f5", color: "#090909" }
                    : { color: "rgba(255,255,255,0.56)" }
                }
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBilling("yearly")}
                className="h-8 pl-4 pr-3 rounded-full text-[11.5px] font-medium transition-colors inline-flex items-center gap-1.5"
                style={
                  billing === "yearly"
                    ? { background: "#f5f5f5", color: "#090909" }
                    : { color: "rgba(255,255,255,0.56)" }
                }
              >
                Yearly
                <span
                  className="inline-flex items-center h-[18px] px-[7px] rounded-full text-[8.5px] font-semibold"
                  style={
                    billing === "yearly"
                      ? { background: "rgba(9,9,9,0.10)", color: "#090909" }
                      : { background: "rgba(66,227,109,0.14)", color: "#42E36D" }
                  }
                >
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[18px] mt-12 items-stretch">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} billing={billing} />
          ))}
        </div>

        <div id="book-a-demo" className="max-w-[560px] mx-auto mt-20 scroll-mt-24">
          <Reveal>
            <div className="text-center mb-8">
              <h3 className="text-[26px] sm:text-[32px] font-semibold tracking-[-0.03em] text-[#f7f7f7]">
                Book a demo.
              </h3>
              <p className="mt-3 text-[13.5px] leading-relaxed text-white/[0.42]">
                Tell us about your business and which plan you're interested
                in. We'll walk you through it and help you pick the right fit.
              </p>
            </div>
            <ServiceInquiryForm
              defaultInterest="AI Presence"
              ctaLabel="Book My Demo"
              title="Tell us about your business"
            />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
