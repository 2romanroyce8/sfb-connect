import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/billing/stripe";
import AddOnsAdmin from "@/components/team/AddOnsAdmin";

export default async function AddOnsAdminPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (caller?.team_role !== "owner") redirect("/team/dashboard");

  const [{ data: products }, { data: packages }, { data: actions }] = await Promise.all([
    supabase.from("addon_products").select("*").order("sort_order"),
    supabase.from("credit_packages").select("*").order("sort_order"),
    supabase.from("action_catalog").select("*").order("name"),
  ]);

  return (
    <AddOnsAdmin
      products={(products ?? []) as any}
      packages={(packages ?? []) as any}
      actions={(actions ?? []) as any}
      stripeConfigured={isStripeConfigured()}
    />
  );
}
