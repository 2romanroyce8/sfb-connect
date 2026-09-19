// Reframed from a one-time 14-day managed-audit workflow (submitted ->
// analyzing -> ... -> completed) into a reusable SFB analysis/scan run --
// a paying customer accumulates many of these over their lifetime, not one.
export type ProjectStatus = "pending" | "running" | "completed" | "failed";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = ["pending", "running", "completed", "failed"];

export type ScanType =
  | "baseline"
  | "visibility_check"
  | "competitor_scan"
  | "knowledge_audit"
  | "website_ai_readiness"
  | "scheduled_monitoring"
  | "manual";

export const SCAN_TYPE_LABELS: Record<ScanType, string> = {
  baseline: "Baseline Analysis",
  visibility_check: "AI Visibility Check",
  competitor_scan: "Competitor Scan",
  knowledge_audit: "Knowledge Audit",
  website_ai_readiness: "Website AI Readiness",
  scheduled_monitoring: "Scheduled Monitoring",
  manual: "Manual",
};

export interface PresenceScore {
  overall_score: number;
  identity_score: number;
  knowledge_score: number;
  authority_score: number;
  location_score: number;
  machine_readability_score: number;
  recorded_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  legal_name: string;
  website: string | null;
  primary_category: string | null;
  description: string | null;
  years_in_business: string | null;
}

export interface Project {
  id: string;
  business_id: string;
  status: ProjectStatus;
  scan_type: ScanType;
  location_id: string | null;
  started_at: string;
  target_completion_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface Recommendation {
  id: string;
  business_id: string;
  finding_id: string | null;
  location_id: string | null;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
}

export interface AuditFinding {
  id: string;
  business_id: string;
  project_id: string;
  location_id: string | null;
  platform: string | null;
  query_text: string | null;
  evidence_text: string | null;
  finding: string;
  recommendation: string | null;
  severity: "info" | "minor" | "moderate" | "critical";
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export type PaymentMethod = "cashapp" | "paypal" | "zelle";
export type PaymentStatus = "pending_review" | "confirmed" | "rejected";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cashapp: "Cash App",
  paypal: "PayPal",
  zelle: "Zelle",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending_review: "Pending Review",
  confirmed: "Confirmed",
  rejected: "Rejected",
};

export interface Payment {
  id: string;
  user_id: string;
  business_id: string | null;
  method: PaymentMethod;
  reference_code: string;
  amount_cents: number;
  currency: string;
  customer_note: string | null;
  proof_screenshot_url: string | null;
  status: PaymentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

export const AUDIT_CATEGORIES: string[] = [
  "Business entity clarity",
  "Name / address / phone consistency",
  "Service definitions",
  "Product definitions",
  "Geographic relevance",
  "Website information architecture",
  "Structured data",
  "Schema markup",
  "Business descriptions",
  "Public citations",
  "Social profiles",
  "Review signals",
  "Authority signals",
  "Knowledge consistency",
  "Frequently asked questions",
  "AI-readable service information",
  "Local business information",
  "Source freshness",
  "Competitive positioning",
  "Entity relationships",
];
