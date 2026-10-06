import { NextResponse, type NextRequest } from "next/server";
import { authenticateAgent, AgentAuthError } from "@/lib/agent/auth";
import { runTool } from "@/lib/agent/tools";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
// REST face of the same semantic tools: POST /api/v1/agent/tools/<name> {args}
// or GET with query parameters. Identical auth, scopes, RLS and audit.
async function handle(req: NextRequest, name: string, args: Record<string, unknown>) {
  try {
    const ctx = await authenticateAgent(req, "api");
    return NextResponse.json({ tool: name, result: await runTool(ctx, name, args, req, "api") });
  } catch (e) {
    if (e instanceof AgentAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: e.status, headers: e.extraHeaders });
    console.error("[agent-rest]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
export async function GET(req: NextRequest, { params }: { params: { name: string } }) { return handle(req, params.name, Object.fromEntries(req.nextUrl.searchParams)); }
export async function POST(req: NextRequest, { params }: { params: { name: string } }) { const body = (await req.json().catch(() => ({}))) as Record<string, unknown>; return handle(req, params.name, body); }
