import { NextResponse, type NextRequest } from "next/server";
import { authenticateAgent, AgentAuthError } from "@/lib/agent/auth";
import { runTool, TOOLS } from "@/lib/agent/tools";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  try {
    const ctx = await authenticateAgent(req, "api");
    const me = await runTool(ctx, "get_sfb_workspace", {}, req, "api");
    return NextResponse.json({ ...(me as object), tools: TOOLS.filter((t) => ctx.scopes.has(t.scope)).map((t) => ({ name: t.name, scope: t.scope, description: t.description, endpoint: `/api/v1/agent/tools/${t.name}` })) });
  } catch (e) {
    if (e instanceof AgentAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: e.status, headers: e.extraHeaders });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
