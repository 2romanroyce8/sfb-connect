import { NextResponse, type NextRequest } from "next/server";
import { authorizationServerMetadata, protectedResourceMetadata, originOf } from "@/lib/agent/oauth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  const origin = originOf(req);
  const body = params.kind === "oauth-protected-resource" ? protectedResourceMetadata(origin) : params.kind === "oauth-authorization-server" ? authorizationServerMetadata(origin) : null;
  if (!body) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" } });
}
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "mcp-protocol-version" } }); }
