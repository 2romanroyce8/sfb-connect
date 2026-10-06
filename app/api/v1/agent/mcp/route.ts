import { NextResponse, type NextRequest } from "next/server";
import { authenticateAgent, AgentAuthError, bearerChallenge, appOrigin } from "@/lib/agent/auth";
import { handleMcp, rpcError } from "@/lib/agent/mcp";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version", "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id" };

function errorResponse(e: unknown, req: NextRequest) {
  if (e instanceof AgentAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: e.status, headers: { ...CORS, ...e.extraHeaders } });
  console.error("[agent-mcp]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: "server_error" }, { status: 500, headers: CORS });
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function GET(req: NextRequest) {
  // No server-initiated stream is offered; a bare unauthenticated probe gets the discovery challenge.
  if (!req.headers.get("authorization")) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers: { ...CORS, ...bearerChallenge(appOrigin(req)) } });
  return NextResponse.json({ error: "method_not_allowed", message: "Use POST with JSON-RPC." }, { status: 405, headers: CORS });
}
export async function DELETE(req: NextRequest) {
  try { await authenticateAgent(req, "mcp"); return new NextResponse(null, { status: 200, headers: CORS }); } catch (e) { return errorResponse(e, req); }
}
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await authenticateAgent(req, "mcp"); } catch (e) { return errorResponse(e, req); }
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json(rpcError(null, -32700, "Parse error"), { status: 400, headers: CORS });
  const messages = Array.isArray(body) ? body : [body];
  const out: unknown[] = [];
  for (const m of messages) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") { out.push(rpcError(m?.id ?? null, -32600, "Invalid Request")); continue; }
    const r = await handleMcp(ctx, m, req);
    if (r) out.push(r);
  }
  if (out.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  return NextResponse.json(Array.isArray(body) ? out : out[0], { headers: { ...CORS, "Content-Type": "application/json" } });
}
