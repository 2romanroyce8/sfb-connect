import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

const CORE = [
  {
    number: "01",
    title: "AI Presence",
    tagline: "Help machines clearly understand your business.",
    items: ["Audit", "Business intelligence", "Entity clarity", "Knowledge optimization", "Machine readability", "Structured data", "AI Presence Score"],
    cta: "Explore AI Presence",
    href: "/#score",
  },
  {
    number: "02",
    title: "Websites",
    tagline: "Build the source customers — and machines — depend on.",
    items: ["Website Rebuilds", "New Websites", "Custom Development", "Responsive Design", "Conversion Architecture", "Technical Structure", "Structured Data", "AI Presence Integration"],
    cta: "Explore Websites",
    href: "/websites",
  },
];

const EXPANSION = [
  { number: "03", title: "Automation", tagline: "Reduce repetitive operational work through custom business workflows.", href: "/solutions/automation" },
  { number: "04", title: "AI Receptionist", tagline: "AI-assisted customer intake and communication systems designed around the business's workflow.", href: "/solutions/ai-receptionist" },
  { number: "05", title: "Marketing", tagline: "Growth strategy and digital marketing support.", href: "/solutions/marketing" },
  { number: "06", title: "Paid Advertising", tagline: "Campaign strategy, creative systems and paid customer acquisition.", href: "/solutions/paid-ads" },
];

export default function ServiceArchitectureSection() {
  return (
    <section className="py-20 md:py-28 px-6" id="services">
      <div className="max-w-[1180px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between flex-wrap gap-4 mb-14">
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray">Core</span>
            <span className="text-[12px] text-white/30 max-w-[320px] text-right hidden sm:block">
              AI Presence is our flagship. Websites are the second core service — everything else extends this foundation.
            </span>
          </div>
        </Reveal>

        <div className="flex flex-col gap-px" style={{ background: "rgba(255,255,255,0.08)" }}>
          {CORE.map((s) => (
            <Reveal key={s.number}>
              <Link
                href={s.href}
                className="group grid md:grid-cols-[100px_1fr_auto] gap-6 items-start md:items-center px-1 py-10 md:py-14 transition-colors hover:bg-white/[0.02]"
                style={{ background: "#000000" }}
              >
                <div className="font-mono text-[15px] text-white/30">{s.number}</div>
                <div>
                  <div className="text-[26px] md:text-[38px] font-semibold tracking-[-0.03em] text-white mb-2">{s.title}</div>
                  <p className="text-[14px] md:text-[15px] text-white/45 max-w-[520px] mb-4">{s.tagline}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {s.items.map((it) => (
                      <span key={it} className="text-[11.5px] text-white/35">
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-white whitespace-nowrap md:justify-self-end">
                  {s.cta}
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-20 mb-8">
            <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray">Expand</span>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-px" style={{ background: "rgba(255,255,255,0.06)" }}>
          {EXPANSION.map((s) => (
            <Reveal key={s.number}>
              <Link href={s.href} className="group flex flex-col justify-between p-6 min-h-[190px] transition-colors hover:bg-white/[0.02]" style={{ background: "#020202" }}>
                <div>
                  <div className="font-mono text-[12px] text-white/25 mb-3">{s.number}</div>
                  <div className="text-[16px] font-medium text-white/85 mb-2">{s.title}</div>
                  <p className="text-[12.5px] leading-relaxed text-white/35">{s.tagline}</p>
                </div>
                <div className="flex items-center gap-1 text-[11.5px] text-white/50 mt-4">
                  Explore
                  <ArrowRight size={11} className="transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
