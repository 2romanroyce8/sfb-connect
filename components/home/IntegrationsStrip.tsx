import Reveal from "@/components/ui/Reveal";
import IntegrationTile from "@/components/home/IntegrationTile";
import { INTEGRATIONS_STRIP_LINE, liveIntegrations } from "@/lib/integrations/registry";

/**
 * "Plugs into your stack" — renders ONLY integrations that are live in the
 * product (lib/integrations/registry.ts). Same tile style as the AI-platform
 * row above it. If nothing is live the strip renders nothing at all rather
 * than a promise.
 */
export default function IntegrationsStrip({ compact = false }: { compact?: boolean }) {
  const items = liveIntegrations();
  if (!items.length) return null;
  if (compact) {
    return (
      <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
        <span className="font-mono text-[11px] tracking-[0.16em] uppercase text-white/[0.4]">Works with</span>
        {items.map((i) => (
          <IntegrationTile key={i.key} integration={i} size="sm" />
        ))}
      </div>
    );
  }
  return (
    <Reveal>
      <div className="mt-20">
        <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Plugs into your stack</span>
        <div className="flex flex-wrap gap-10 md:gap-14 justify-center items-start mt-10">
          {items.map((i) => (
            <IntegrationTile key={i.key} integration={i} />
          ))}
        </div>
        <p className="mt-10 text-[14px] text-white/[0.5]">{INTEGRATIONS_STRIP_LINE}</p>
      </div>
    </Reveal>
  );
}
