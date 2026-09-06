// Shared stage vocabulary + weighting for live research-job progress.
// Progress must reflect real pipeline stage completion, never a fake timer —
// this table is the single source of truth both the backend (updating
// crm_research_jobs as the Deep Research Coordinator actually reaches each
// stage) and the frontend (rendering stage labels) read from, so they can
// never drift.
//
// V4: stages now reflect the real Discovery Graph + 8 QA passes, not just a
// linear fetch->extract pipeline. VERIFYING_SOURCES and GAP_ANALYSIS are new
// real stages (not cosmetic) — they correspond to actual verification-pass
// and gap-analysis-reopen work the coordinator does.
export const RESEARCH_STAGES = [
  "QUEUED",
  "DISCOVERING_SOURCES",
  "READING_WEBSITE",
  "VERIFYING_SOURCES",
  "EXTRACTING_CONTACTS",
  "EXTRACTING_LOCATIONS",
  "EXTRACTING_SOCIALS",
  "CLASSIFYING_BUSINESS",
  "CROSS_VALIDATING",
  "GAP_ANALYSIS",
  "QA_1",
  "QA_2",
  "QA_3",
  "QA_4",
  "QA_5",
  "QA_6",
  "QA_7",
  "QA_8",
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
  DISCOVERING_SOURCES: 15,
  READING_WEBSITE: 25,
  VERIFYING_SOURCES: 35,
  EXTRACTING_CONTACTS: 45,
  EXTRACTING_LOCATIONS: 52,
  EXTRACTING_SOCIALS: 59,
  CLASSIFYING_BUSINESS: 65,
  CROSS_VALIDATING: 70,
  GAP_ANALYSIS: 75,
  QA_1: 78,
  QA_2: 80,
  QA_3: 82,
  QA_4: 84,
  QA_5: 86,
  QA_6: 88,
  QA_7: 91,
  QA_8: 95,
  BUILDING_PROFILE: 98,
  COMPLETE: 100,
};

export const STAGE_HEADLINE: Record<ResearchStage, string> = {
  QUEUED: "Preparing research",
  DISCOVERING_SOURCES: "Discovering public sources",
  READING_WEBSITE: "Reading official website",
  VERIFYING_SOURCES: "Verifying discovered sources",
  EXTRACTING_CONTACTS: "Extracting contacts",
  EXTRACTING_LOCATIONS: "Finding locations & service areas",
  EXTRACTING_SOCIALS: "Finding social profiles",
  CLASSIFYING_BUSINESS: "Classifying business",
  CROSS_VALIDATING: "Cross-validating evidence",
  GAP_ANALYSIS: "Analyzing gaps",
  QA_1: "Quality check 1/8 — Identity",
  QA_2: "Quality check 2/8 — Contact",
  QA_3: "Quality check 3/8 — External links",
  QA_4: "Quality check 4/8 — Website",
  QA_5: "Quality check 5/8 — Social presence",
  QA_6: "Quality check 6/8 — Location & service",
  QA_7: "Quality check 7/8 — Gap analysis",
  QA_8: "Quality check 8/8 — Final profile",
  BUILDING_PROFILE: "Building research profile",
  COMPLETE: "Research complete",
};

// Compact stage-marker groups shown in the UI (fewer buckets than the full
// pipeline so the dot row stays readable).
export const STAGE_MARKERS: { label: string; stages: ResearchStage[] }[] = [
  { label: "Discovery", stages: ["QUEUED", "DISCOVERING_SOURCES"] },
  { label: "Website", stages: ["READING_WEBSITE", "VERIFYING_SOURCES"] },
  { label: "Contacts", stages: ["EXTRACTING_CONTACTS"] },
  { label: "Locations", stages: ["EXTRACTING_LOCATIONS"] },
  { label: "Socials", stages: ["EXTRACTING_SOCIALS", "CLASSIFYING_BUSINESS"] },
  { label: "QA", stages: ["CROSS_VALIDATING", "GAP_ANALYSIS", "QA_1", "QA_2", "QA_3", "QA_4", "QA_5", "QA_6", "QA_7", "QA_8", "BUILDING_PROFILE", "COMPLETE"] },
];

export function progressForStage(stage: ResearchStage): number {
  return STAGE_PROGRESS[stage] ?? 0;
}
