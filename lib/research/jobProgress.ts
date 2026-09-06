// Shared stage vocabulary + weighting for live research-job progress.
// Progress must reflect real pipeline stage completion, never a fake timer —
// this table is the single source of truth both the backend (updating
// crm_research_jobs as buildLeadProfile actually reaches each stage) and the
// frontend (rendering stage labels) read from, so they can never drift.
export const RESEARCH_STAGES = [
  "QUEUED",
  "IDENTIFYING_BUSINESS",
  "DISCOVERING_SOURCES",
  "READING_WEBSITE",
  "EXTRACTING_CONTACTS",
  "EXTRACTING_LOCATIONS",
  "EXTRACTING_SOCIALS",
  "CLASSIFYING_BUSINESS",
  "CROSS_VALIDATING",
  "BUILDING_PROFILE",
  "COMPLETE",
] as const;

export type ResearchStage = (typeof RESEARCH_STAGES)[number];
export type ResearchJobStatus = "running" | "complete" | "failed";

// Cumulative percent once a stage has been REACHED (not a per-stage weight
// added up piecemeal — cumulative avoids any rounding drift and matches
// "how far through the pipeline are we" directly).
export const STAGE_PROGRESS: Record<ResearchStage, number> = {
  QUEUED: 2,
  IDENTIFYING_BUSINESS: 12,
  DISCOVERING_SOURCES: 24,
  READING_WEBSITE: 40,
  EXTRACTING_CONTACTS: 55,
  EXTRACTING_LOCATIONS: 65,
  EXTRACTING_SOCIALS: 75,
  CLASSIFYING_BUSINESS: 85,
  CROSS_VALIDATING: 93,
  BUILDING_PROFILE: 97,
  COMPLETE: 100,
};

export const STAGE_HEADLINE: Record<ResearchStage, string> = {
  QUEUED: "Preparing research",
  IDENTIFYING_BUSINESS: "Identifying business",
  DISCOVERING_SOURCES: "Discovering public sources",
  READING_WEBSITE: "Reading official website",
  EXTRACTING_CONTACTS: "Extracting contacts",
  EXTRACTING_LOCATIONS: "Finding locations & service areas",
  EXTRACTING_SOCIALS: "Finding social profiles",
  CLASSIFYING_BUSINESS: "Classifying business",
  CROSS_VALIDATING: "Cross-validating evidence",
  BUILDING_PROFILE: "Building research profile",
  COMPLETE: "Research complete",
};

// Compact stage-marker groups shown in the UI (fewer buckets than the full
// pipeline so the dot row stays readable).
export const STAGE_MARKERS: { label: string; stages: ResearchStage[] }[] = [
  { label: "Identity", stages: ["QUEUED", "IDENTIFYING_BUSINESS"] },
  { label: "Website", stages: ["DISCOVERING_SOURCES", "READING_WEBSITE"] },
  { label: "Contacts", stages: ["EXTRACTING_CONTACTS"] },
  { label: "Locations", stages: ["EXTRACTING_LOCATIONS"] },
  { label: "Socials", stages: ["EXTRACTING_SOCIALS", "CLASSIFYING_BUSINESS"] },
  { label: "Validation", stages: ["CROSS_VALIDATING", "BUILDING_PROFILE", "COMPLETE"] },
];

export function progressForStage(stage: ResearchStage): number {
  return STAGE_PROGRESS[stage] ?? 0;
}
