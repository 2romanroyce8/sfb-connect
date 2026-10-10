import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadIntegrationRegistry } from "@/lib/integrations/registry";
import { listConnectionSummaries } from "@/lib/integrations/connections";
import { OAUTH_PROVIDERS, isOAuthProviderKey, oauthConfigured } from "@/lib/integrations/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Customer view: OAuth integrations only (team-side Zapier/webhooks/Calendar are not customer connections), with the caller's own connection state. */
export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const [registry, mine] = await Promise.all([loadIntegrationRegistry(), listConnectionSummaries(user.id)]);
  const items = registry.filter((i) => isOAuthProviderKey(i.key)).map((i) => {
    const c = mine.find((m) => m.provider === i.key) ?? null;
    return { key: i.key, name: i.name, description: i.description, logo: i.logo, status: i.status, configured: oauthConfigured(OAUTH_PROVIDERS[i.key as keyof typeof OAUTH_PROVIDERS]), connected: c ? { account_label: c.account_label, connected_at: c.connected_at, status: c.status, last_error: c.last_error } : null };
  });
  return NextResponse.json({ items });
}
