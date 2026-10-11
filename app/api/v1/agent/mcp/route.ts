import { NextResponse, type NextRequest } from "next/server";
import { authenticateAgent, AgentAuthError, bearerChallenge, appOrigin } from "@/lib/agent/auth";
import { handleMcp, rpcError } from "@/lib/agent/mcp";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS", "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version", "Access-Control-Expose-Headers": "WWW-Authenticate, mcp-session-id" };

/** JSON with an explicit byte Content-Length and no caching. Route handlers are otherwise streamed as
 * Transfer-Encoding: chunked; a client (Muse, 2026-10-11) saw the chunked stream close mid-body
 * (IncompleteRead) on list_tasks and later on 12 KB write confirmations, so give the proxy a fixed length. */
function json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  const text = JSON.stringify(body);
  return new NextResponse(text, { status: init.status ?? 200, headers: { ...CORS, ...(init.headers ?? {}), "Content-Type": "application/json; charset=utf-8", "Content-Length": String(Buffer.byteLength(text, "utf8")), "Cache-Control": "no-store" } });
}
function errorResponse(e: unknown, req: NextRequest) {
  if (e instanceof AgentAuthError) return json({ error: e.code, error_description: e.message }, { status: e.status, headers: e.extraHeaders });
  console.error("[agent-mcp]", e instanceof Error ? e.message : e);
  return json({ error: "server_error" }, { status: 500 });
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: CORS }); }
export async function GET(req: NextRequest) {
  // No server-initiated stream is offered; a bare unauthenticated probe gets the discovery challenge.
  if (!req.headers.get("authorization")) return json({ error: "unauthenticated" }, { status: 401, headers: bearerChallenge(appOrigin(req)) });
  return json({ error: "method_not_allowed", message: "Use POST with JSON-RPC." }, { status: 405 });
}
export async function DELETE(req: NextRequest) {
  try { await authenticateAgent(req, "mcp"); return new NextResponse(null, { status: 200, headers: CORS }); } catch (e) { return errorResponse(e, req); }
}
export async function POST(req: NextRequest) {
  let ctx;
  try { ctx = await authenticateAgent(req, "mcp"); } catch (e) { return errorResponse(e, req); }
  const body = await req.json().catch(() => null);
  if (!body) return json(rpcError(null, -32700, "Parse error"), { status: 400 });
  const messages = Array.isArray(body) ? body : [body];
  const out: unknown[] = [];
  for (const m of messages) {
    if (!m || m.jsonrpc !== "2.0" || typeof m.method !== "string") { out.push(rpcError(m?.id ?? null, -32600, "Invalid Request")); continue; }
    const r = await handleMcp(ctx, m, req);
    if (r) out.push(r);
  }
  if (out.length === 0) return new NextResponse(null, { status: 202, headers: CORS });
  return json(Array.isArray(body) ? out : out[0]);
}
