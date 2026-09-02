export type ProjectStatus =
  | "submitted"
  | "analyzing"
  | "researching"
  | "optimizing"
  | "final_review"
  | "completed";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  submitted: "Submitted",
  analyzing: "Analyzing",
  researching: "Researching",
  optimizing: "Optimizing",
  final_review: "Final Review",
  completed: "Completed",
};

export const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "submitted",
  "analyzing",
  "researching",
  "optimizing",
  "final_review",
  "completed",
];

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
  started_at: string;
  target_completion_at: string | null;
  completed_at: string | null;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
}

export interface AuditFinding {
  id: string;
  finding: string;
  recommendation: string | null;
  severity: "info" | "minor" | "moderate" | "critical";
  resolved: boolean;
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
