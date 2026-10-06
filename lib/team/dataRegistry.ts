// ============================================================
// OWNER DATA CONTROL — the single whitelist of what the owner may delete
// from Settings → Danger Zone, and what "Reset workspace" wipes.
//
// Nothing outside this list can be touched through the data-control API,
// and the API only ever addresses tables by these keys (never by a table
// name supplied by the client). Order matters for the reset: children are
// listed before parents so FK NO ACTION constraints never block the wipe.
// ============================================================

export type DataCategory = {
  key: string;
  table: string;
  label: string;
  group: "Leads & pipeline" | "Research" | "Audits" | "Activity" | "Team & performance" | "Documents" | "Work plan & territories" | "Inbound";
  /** Included in "Reset workspace". Config-like tables are left alone by the reset but remain individually deletable. */
  inReset: boolean;
  /** Column used to order "most recent first" listings. */
  orderBy?: string;
};

export const DATA_CATEGORIES: DataCategory[] = [
  // Leads & pipeline (children first)
  { key: "lead_notes", table: "crm_notes", label: "Lead notes", group: "Leads & pipeline", inReset: true },
  { key: "call_notes", table: "crm_call_notes", label: "Call notes", group: "Activity", inReset: true },
  { key: "followups", table: "crm_followups", label: "Follow-ups", group: "Activity", inReset: true },
  { key: "meetings", table: "crm_meetings", label: "Meetings", group: "Activity", inReset: true },
  { key: "calls", table: "crm_calls", label: "Calls", group: "Activity", inReset: true },
  { key: "activities", table: "crm_activities", label: "Activity feed", group: "Activity", inReset: true },
  { key: "notifications", table: "crm_notifications", label: "Notifications", group: "Activity", inReset: true },
  { key: "scripts", table: "crm_scripts", label: "Call scripts", group: "Activity", inReset: true },
  { key: "calendar_events", table: "crm_calendar_events", label: "Calendar events", group: "Activity", inReset: true },
  { key: "pipeline_history", table: "crm_pipeline_history", label: "Pipeline history", group: "Leads & pipeline", inReset: true, orderBy: "changed_at" },
  { key: "opportunities", table: "crm_opportunities", label: "Opportunities (recommended offers)", group: "Leads & pipeline", inReset: true },
  { key: "lead_evidence", table: "crm_lead_evidence", label: "Lead evidence", group: "Leads & pipeline", inReset: true },
  { key: "audit_categories", table: "crm_audit_categories", label: "Audit category scores", group: "Audits", inReset: true },
  { key: "audits", table: "crm_audits", label: "Business Readiness Audits", group: "Audits", inReset: true },
  { key: "leads", table: "crm_leads", label: "Leads", group: "Leads & pipeline", inReset: true },
  // Research
  { key: "research_relationships", table: "crm_research_entity_relationships", label: "Research entity relationships", group: "Research", inReset: true },
  { key: "research_entities", table: "crm_research_entities", label: "Research entities", group: "Research", inReset: true },
  { key: "research_sources", table: "crm_research_sources", label: "Research sources", group: "Research", inReset: true, orderBy: "ordinal" },
  { key: "research_jobs", table: "crm_research_jobs", label: "Research jobs", group: "Research", inReset: true },
  { key: "research_results", table: "crm_research_results", label: "Research results (queue)", group: "Research", inReset: true },
  // Team & performance
  { key: "work_sessions", table: "team_work_sessions", label: "Clock-in sessions", group: "Team & performance", inReset: true, orderBy: "clocked_in_at" },
  { key: "point_events", table: "staff_point_events", label: "Leaderboard point events", group: "Team & performance", inReset: true },
  { key: "awards", table: "staff_awards", label: "Staff awards", group: "Team & performance", inReset: true },
  { key: "leaderboard_snapshots", table: "leaderboard_snapshots", label: "Leaderboard snapshots", group: "Team & performance", inReset: true },
  { key: "competition_periods", table: "competition_periods", label: "Competition periods", group: "Team & performance", inReset: true },
  { key: "competition_incentives", table: "competition_incentives", label: "Competition incentives", group: "Team & performance", inReset: true },
  { key: "competition_rules", table: "competition_scoring_rules", label: "Competition scoring rules (config)", group: "Team & performance", inReset: false },
  // Work plan & territories
  { key: "work_plan_items", table: "crm_work_plan_items", label: "Work plan items", group: "Work plan & territories", inReset: true },
  { key: "work_plan_milestones", table: "crm_work_plan_milestones", label: "Work plan milestones", group: "Work plan & territories", inReset: true },
  { key: "work_plans", table: "crm_work_plans", label: "Work plans", group: "Work plan & territories", inReset: true },
  { key: "territory_progress", table: "wp_territory_progress", label: "Territory progress", group: "Work plan & territories", inReset: true },
  { key: "territory_assignments", table: "wp_territory_assignments", label: "Territory assignments", group: "Work plan & territories", inReset: true },
  { key: "market_performance", table: "wp_market_performance", label: "Market performance", group: "Work plan & territories", inReset: true },
  { key: "market_discovery_jobs", table: "wp_market_discovery_jobs", label: "Market discovery jobs", group: "Work plan & territories", inReset: true },
  { key: "markets", table: "wp_city_niche_markets", label: "City × niche markets (config)", group: "Work plan & territories", inReset: false },
  // Documents
  { key: "document_activity", table: "crm_document_activity", label: "Document activity", group: "Documents", inReset: true },
  { key: "document_bookmarks", table: "crm_document_bookmarks", label: "Document bookmarks", group: "Documents", inReset: true },
  { key: "document_folder_items", table: "crm_document_folder_items", label: "Document folder items", group: "Documents", inReset: true },
  { key: "documents", table: "crm_documents", label: "Documents", group: "Documents", inReset: true },
  { key: "document_folders", table: "crm_document_folders", label: "Document folders (config)", group: "Documents", inReset: false },
  // Inbound
  { key: "demo_requests", table: "demo_requests", label: "Demo requests", group: "Inbound", inReset: true },
  { key: "schedule_audit_log", table: "crm_schedule_audit_log", label: "Schedule audit log", group: "Team & performance", inReset: true },
];

export const CATEGORY_BY_KEY = new Map(DATA_CATEGORIES.map((c) => [c.key, c]));
export const RESET_CATEGORIES = DATA_CATEGORIES.filter((c) => c.inReset);
/** Exact phrase the owner must type to run a full reset. */
export const RESET_CONFIRM_PHRASE = "RESET SFB CONNECT TEAM";

/** Never deletable through this API, by construction (not in the registry): users, auth, agent_* tables, billing, customers, businesses, calendar connections. */
export function isDeletableCategory(key: string): boolean {
  return CATEGORY_BY_KEY.has(key);
}

export function rowLabel(row: Record<string, unknown>): string {
  for (const k of ["business_name", "full_name", "name", "title", "subject", "url", "started_for", "email", "phone", "action", "to_stage", "status"]) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim().slice(0, 90);
  }
  return String(row.id ?? "").slice(0, 36);
}
