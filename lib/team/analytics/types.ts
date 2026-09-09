export type AnalyticsRange = "1d" | "3d" | "5d" | "7d" | "30d" | "3m" | "6m" | "12m" | "all";

export type BucketGranularity = "hour" | "day" | "week" | "month";

export interface RevenueAnalyticsSummary {
  revenue: number;
  dealsWon: number;
  averageDealValue: number;
  previousRevenue: number | null;
  changeAmount: number | null;
  changePercent: number | null;
}

export interface RevenueTimelinePoint {
  key: string;
  label: string;
  revenue: number;
  deals: number;
}

export interface RevenueByPlanRow {
  planKey: string;
  planLabel: string;
  revenue: number;
  deals: number;
  sharePercent: number;
}

export interface RevenueByRepRow {
  repId: string;
  repName: string;
  revenue: number;
  deals: number;
  averageDealValue: number;
}

export interface RecentRevenueRow {
  id: string;
  occurredAt: string;
  businessName: string | null;
  repName: string | null;
  planKey: string;
  planLabel: string;
  amount: number;
  eventType: string;
  leadId: string | null;
}

export interface RevenueAnalytics {
  range: AnalyticsRange;
  granularity: BucketGranularity;
  summary: RevenueAnalyticsSummary;
  timeline: RevenueTimelinePoint[];
  byPlan: RevenueByPlanRow[];
  byRep: RevenueByRepRow[] | null;
  recent: RecentRevenueRow[];
  // Always false today -- no recurring subscription/billing model exists
  // yet, so MRR can only be honestly reported as unavailable, never
  // inferred from one-time closed-deal revenue_events.
  mrrAvailable: false;
  employees: { id: string; name: string }[] | null;
}
