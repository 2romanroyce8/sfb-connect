import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import IntegrationRegistryList from "@/components/team/IntegrationRegistryList";
import { loadIntegrationRegistry } from "@/lib/integrations/registry";

// Hidden owner-only audit of the integrations registry (blockers, env var
// names, what the public site may show). Deliberately NOT in the sidebar —
// developer detail that does not belong on the Integrations page itself.
export default async function IntegrationRegistryPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: caller } = await supabase.from("users").select("team_role").eq("id", user!.id).single();
  if (caller?.team_role !== "owner") redirect("/team/integrations");
  const registry = await loadIntegrationRegistry();
  return (
    <div className="px-8 py-8">
      <Link href="/team/integrations" className="text-[12px] text-[#A1A1A6] underline underline-offset-2">← Integrations</Link>
      <IntegrationRegistryList items={registry} />
    </div>
  );
}
