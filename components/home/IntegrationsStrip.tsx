import Reveal from "@/components/ui/Reveal";
import IntegrationTile from "@/components/home/IntegrationTile";
import { loadIntegrationRegistry, liveOf, stripTagline } from "@/lib/integrations/registry";

/**
 * WORKS WITH — renders ONLY integrations that are live in the product
 * (lib/integrations/registry.ts, status computed from env + verified
 * connections). New Live entries appear with zero manual edits. Live tiles
 * always carry an official brand mark (enforced by test). The tagline is
 * tempered until at least three integrations are live.
 * Never put AI assistants here: they are not connectable (see PlatformsSection).
 */
export default async function IntegrationsStrip({ compact = false }: { compact?: boolean }) {
  const items = liveOf(await loadIntegrationRegistry()).filter((i) => !!i.logo);
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
        <span className="font-mono text-xs tracking-[0.18em] uppercase text-medium-gray mb-5 block">Works with</span>
        <div className="flex flex-wrap gap-10 md:gap-14 justify-center items-start mt-10">
          {items.map((i) => (
            <IntegrationTile key={i.key} integration={i} />
          ))}
        </div>
        <p className="mt-10 text-[14px] text-white/[0.5]">{stripTagline(items.length)}</p>
      </div>
    </Reveal>
  );
}
