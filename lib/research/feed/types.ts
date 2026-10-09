/**
 * Prospect research feed — nightly discovery of NEW local businesses that fit
 * a target (vertical × city × state), fed into the agent task queue for
 * qualification.
 *
 * This sits BEHIND the existing research layer, not beside it: a feed finding
 * is a lead *candidate*. It is never "confirmed" — only the full seed-based
 * research pipeline (buildLeadProfile → reconcile) can confirm an identity.
 * Feed identity labels are therefore deliberately weaker than the research
 * layer's, and say so.
 */
export type FeedSourceKind = "exa" | "rss";

export type FeedTarget = {
  id: string;
  vertical: string;      // e.g. "roofing"
  city: string;          // e.g. "Tampa"
  state: string;         // two-letter US code, e.g. "FL"
  queries: string[] | null; // optional query overrides (Exa)
  active: boolean;
};

export type RssFeed = { id: string; url: string; label: string; active: boolean };

/** What a source returns before any judgement is applied. */
export type RawFinding = {
  sourceKind: FeedSourceKind;
  sourceUrl: string;          // the search query URL (exa) or feed item link (rss)
  title: string;
  snippet: string;
  url: string | null;         // candidate business website (exa) — null for rss items
  publishedAt: string | null;
  targetId: string;
};

export type QualityFlag =
  | "missing_city_state"
  | "non_us"
  | "state_mismatch"
  | "chain_or_franchise"
  | "directory_or_aggregator"
  | "junk_name"
  | "duplicate_in_batch"
  | "duplicate_in_crm"
  | "duplicate_prior_finding";

/**
 * Feed identity labels (weaker than research-layer labels on purpose):
 *  - corroborated: the website's own domain names the business AND we have a
 *                  phone or a city — two independent facts agree.
 *  - name_only:    a name plus one contact fact, nothing corroborating it.
 *  - unverified:   extracted from prose (news item); nothing checked.
 */
export type IdentityLabel = "unverified" | "name_only" | "corroborated";

export type Candidate = {
  name: string;
  website: string | null;
  canonicalDomain: string | null;
  phoneE164: string | null;
  city: string | null;
  state: string | null;
  category: string;
  snippet: string;
  sourceKind: FeedSourceKind;
  sourceUrl: string;
  publishedAt: string | null;
  targetId: string;
  identityLabel: IdentityLabel;
  dedupeKey: string;
  flags: QualityFlag[];
};

export interface FeedSource {
  kind: FeedSourceKind;
  isConfigured(): boolean;
  pull(target: FeedTarget, opts: { limit: number; signal?: AbortSignal }): Promise<RawFinding[]>;
}

export type RunSummary = {
  runId: string | null;
  trigger: "cron" | "manual" | "cli";
  startedAt: string;
  finishedAt: string;
  targetsRun: string[];
  targetsSkipped: string[];   // deadline hit before these were reached
  pulled: number;
  accepted: number;
  dropped: Record<QualityFlag, number>;
  tasksCreated: { taskId: string; targetId: string; findings: number }[];
  errors: string[];
};
