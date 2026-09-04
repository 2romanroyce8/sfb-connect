import Link from "next/link";
import { Check, Star } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  button: string;
  href: string;
  buttonStyle: "dark" | "light";
  accent: string;
  badge?: string;
  featured?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "audit",
    name: "AI Presence Audit",
    price: "$200",
    period: "/year",
    description:
      "For businesses that want a clear picture of how AI currently understands and recommends them.",
    button: "Get Started",
    href: "/pay",
    buttonStyle: "dark",
    accent: "#5577FF",
    features: [
      "2-week business audit",
      "AI presence analysis",
      "Business identity review",
      "Machine readability review",
      "Structured data review",
      "Action plan",
    ],
  },
  {
    id: "pro",
    name: "AI Presence Pro",
    price: "$200",
    period: "/year",
    description:
      "For businesses ready to improve how clearly AI systems understand, categorize, and surface them.",
    button: "Start AI Presence",
    href: "/pay",
    buttonStyle: "light",
    accent: "#FFFFFF",
    badge: "POPULAR",
    featured: true,
    features: [
      "Everything in Audit",
      "Entity optimization",
      "Knowledge optimization",
      "Local presence review",
      "AI-readable service structure",
      "Ongoing annual review",
    ],
  },
  {
    id: "custom",
    name: "Website + AI Presence",
    price: "Custom",
    period: "",
    description:
      "For businesses that need a stronger website foundation alongside their AI presence strategy.",
    button: "Contact Us",
    href: "mailto:hello@sfbconnect.com",
    buttonStyle: "dark",
    accent: "#42E36D",
    features: [
      "Website rebuild or new site",
      "AI presence optimization",
      "Structured business information",
      "Conversion-focused UX",
      "Mobile optimization",
      "Custom implementation",
    ],
  },
];

function PlanCard({ plan, index }: { plan: Plan; index: number }) {
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
              {plan.price}
            </span>
            {plan.period && (
              <span className="text-[13px] text-white/[0.36]">
                {plan.period}
              </span>
            )}
          </div>

          <p className="mt-[18px] min-h-[62px] text-[13px] leading-relaxed text-white/[0.42]">
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
            <span className="inline-flex items-center h-7 px-3 mt-6 rounded-full bg-[#121212] border border-white/[0.08] text-[10px] font-medium text-white/[0.62]">
              Billed annually
            </span>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-[18px] mt-12 items-stretch">
          {PLANS.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} index={i} />
          ))}
        </div>

        <Reveal>
          <div className="text-center text-[12.5px] text-medium-gray mt-10">
            Pay via Cash App, PayPal, or Zelle.
          </div>
        </Reveal>
      </div>
    </section>
  );
}
