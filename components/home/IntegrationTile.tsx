"use client";

import { Plug } from "lucide-react";
import type { Integration } from "@/lib/integrations/registry";
import { trackMarketingEvent } from "@/lib/marketingEvents";

/** One integration tile; fires integration_tile_click so Atlas can read interest later. */
export default function IntegrationTile({ integration, size = "md" }: { integration: Integration; size?: "md" | "sm" }) {
  const box = size === "sm" ? "w-7 h-7" : "w-12 h-12";
  return (
    <button
      type="button"
      onClick={() => trackMarketingEvent("integration_tile_click", { integration: integration.key })}
      title={integration.description}
      className={size === "sm" ? "inline-flex items-center gap-2 min-h-[44px] text-[13px] font-semibold text-white/[0.75] hover:text-white transition-colors" : "flex flex-col items-center gap-3 w-[92px] min-h-[44px] bg-transparent border-0 cursor-pointer"}
    >
      <span className={`${box} flex items-center justify-center`}>
        {integration.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={integration.logo} alt={integration.name} className="max-w-full max-h-full object-contain opacity-80 hover:opacity-100 transition-opacity" />
        ) : (
          <span className={`${box} rounded-full border border-white/15 flex items-center justify-center text-medium-gray`}><Plug className="w-5 h-5" strokeWidth={1.75} /></span>
        )}
      </span>
      <span className={size === "sm" ? "" : "text-sm font-semibold text-medium-gray tracking-tight hover:text-white transition-colors"}>{integration.name}</span>
    </button>
  );
}
