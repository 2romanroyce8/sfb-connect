import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Reveal from "@/components/ui/Reveal";

type PreviewProject = {
  slug: string;
  business_name: string;
  industry: string | null;
  project_type: string;
  cover_image_url: string | null;
};

// Homepage "Selected Work" preview. If there are no published projects yet,
// this renders nothing at all — never fake portfolio cards just to fill the
// section. Real projects appear here the moment they're published from
// /team/portfolio.
export default function PortfolioPreviewSection({ projects }: { projects: PreviewProject[] }) {
  if (projects.length === 0) return null;

  return (
    <section className="py-24 md:py-32 px-6 border-t border-white/10">
      <div className="max-w-[1180px] mx-auto">
        <Reveal>
          <div className="flex items-end justify-between flex-wrap gap-4 mb-12">
            <div>
              <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Selected Work</span>
              <h2 className="text-[32px] sm:text-[42px] md:text-[52px] font-extrabold tracking-[-0.03em] leading-[1.05]">
                Websites built to move businesses forward.
              </h2>
            </div>
            <Link href="/portfolio" className="hidden sm:inline-flex items-center gap-1.5 text-[14px] font-medium text-white/70 hover:text-white transition-colors whitespace-nowrap">
              View All Work <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-5">
          {projects.map((p) => (
            <Reveal key={p.slug}>
              <Link href={`/portfolio/${p.slug}`} className="group block">
                <div className="rounded-[16px] overflow-hidden border border-white/10 aspect-[4/3] bg-[#0A0A0A] relative">
                  {p.cover_image_url ? (
                    <img src={p.cover_image_url} alt={p.business_name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20 text-[13px]">{p.business_name}</div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div>
                    <div className="text-[16px] font-medium text-white">{p.business_name}</div>
                    <div className="text-[12.5px] text-white/40 mt-0.5">{[p.industry, p.project_type.replace(/_/g, " ")].filter(Boolean).join(" · ")}</div>
                  </div>
                  <ArrowRight size={15} className="text-white/30 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="sm:hidden mt-8 text-center">
          <Link href="/portfolio" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-white/70 hover:text-white">
            View All Work <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </section>
  );
}
