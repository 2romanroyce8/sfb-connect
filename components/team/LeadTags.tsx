"use client";

import Link from "next/link";

// Tag chips for a lead (e.g. roofing-pilot, verified-phone, priority-dossier).
// Tags are written by the CSV importer into crm_leads.tags. When `linkTags`
// is on, each chip links to the Leads list filtered by that tag.

const TAG_TONE: Record<string, string> = {
  "priority-dossier": "var(--hx-ff9f0a)",
  "verified-phone": "var(--hx-30d158)",
  "roofing-pilot": "var(--hx-0a84ff)",
};

export function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return Array.from(new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)));
}

export default function LeadTags({
  tags,
  linkTags = false,
  activeTag,
  size = "sm",
}: {
  tags: unknown;
  linkTags?: boolean;
  activeTag?: string | null;
  size?: "sm" | "md";
}) {
  const list = normalizeTags(tags);
  if (list.length === 0) return null;
  const text = size === "md" ? "text-[11.5px] px-2 py-[3px]" : "text-[10.5px] px-1.5 py-[2px]";

  return (
    <div className="flex flex-wrap items-center gap-1" data-lead-tags>
      {list.map((t) => {
        const tone = TAG_TONE[t] || "var(--hx-a1a1a6)";
        const active = activeTag === t;
        const style = {
          color: tone,
          border: `1px solid ${active ? tone : "rgb(var(--w) / 0.14)"}`,
          background: active ? "rgb(var(--w) / 0.06)" : "transparent",
        };
        const cls = `${text} rounded-[5px] font-medium leading-none whitespace-nowrap`;
        return linkTags ? (
          <Link
            key={t}
            href={`/team/leads?tag=${encodeURIComponent(t)}`}
            onClick={(e) => e.stopPropagation()}
            className={`${cls} hover:opacity-80`}
            style={style}
            title={`Show leads tagged ${t}`}
          >
            {t}
          </Link>
        ) : (
          <span key={t} className={cls} style={style}>
            {t}
          </span>
        );
      })}
    </div>
  );
}
