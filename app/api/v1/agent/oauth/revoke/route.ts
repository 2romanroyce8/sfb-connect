import { NextResponse, type NextRequest } from "next/server";
import { authorizationIdForToken } from "@/lib/agent/store";
import { revokeAuthorizationFully } from "@/lib/agent/revoke";
import { authenticateClient, readForm } from "@/lib/agent/oauth";
export const dynamic = "force-dynamic";
// RFC 7009: always 200, even for unknown tokens.
export async function POST(req: NextRequest) {
  const form = await readForm(req);
  const auth = await authenticateClient(req, form);
  if ("error" in auth) return auth.error;
  const token = form.get("token");
  if (token) { const id = await authorizationIdForToken(token); if (id) await revokeAuthorizationFully(id, "client_revocation"); }
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
