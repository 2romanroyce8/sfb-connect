import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailableBalance, getCreditBalance } from "@/lib/billing/credits";

export type RecommendationItem = {
  id: string;
  title: string;
  description: string | null;
  priority: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "done";
  finding_id: string | null;
  created_at: string;
};

export async function getRecommendations(businessId: string): Promise<RecommendationItem[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("recommendations")
    .select("id, title, description, priority, status, finding_id, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type CatalogAction = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  creditCost: number;
  affordable: boolean;
};

/**
 * Every row in action_catalog is credit-metered -- the entitlement engine
 * (lib/billing/entitlements.ts) does not currently have a concept of
 * "included free actions" per plan, so there is no honest "included" vs
 * "requires add-on" distinction to draw here yet. The only real gate today
 * is available credit balance, so that's the only thing this checks.
 */
export async function getAvailableActions(businessId: string): Promise<CatalogAction[]> {
  const supabase = createSupabaseServerClient();
  const [{ data: catalog }, available] = await Promise.all([
    supabase.from("action_catalog").select("id, key, name, description, credit_cost").eq("active", true).order("credit_cost"),
    getAvailableBalance(supabase, businessId),
  ]);

  return (catalog ?? []).map((a) => ({
    id: a.id,
    key: a.key,
    name: a.name,
    description: a.description,
    creditCost: a.credit_cost,
    affordable: available >= a.credit_cost,
  }));
}

export type ReservationItem = {
  id: string;
  actionName: string;
  credits: number;
  status: "RESERVED" | "EXECUTING" | "COMPLETED" | "FAILED";
  createdAt: string;
};

export async function getReservations(businessId: string): Promise<ReservationItem[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("action_credit_reservations")
    .select("id, credits, status, created_at, action_catalog(name)")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);

  return (data ?? []).map((r: any) => ({
    id: r.id,
    actionName: r.action_catalog?.name ?? "Action",
    credits: r.credits,
    status: r.status,
    createdAt: r.created_at,
  }));
}

export type CreditLedgerEntry = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
};

export async function getCreditHistory(businessId: string, limit = 20): Promise<CreditLedgerEntry[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("credit_transactions")
    .select("id, type, amount, description, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((t) => ({ id: t.id, type: t.type, amount: t.amount, description: t.description, createdAt: t.created_at }));
}

export async function getCreditSummary(businessId: string) {
  const supabase = createSupabaseServerClient();
  const [settled, available] = await Promise.all([getCreditBalance(supabase, businessId), getAvailableBalance(supabase, businessId)]);
  return { settled, available, reserved: settled - available };
}
