import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function listPaymentsForAdmin() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("payments")
    .select(`*, users ( email )`)
    .order("created_at", { ascending: false });

  return data || [];
}
