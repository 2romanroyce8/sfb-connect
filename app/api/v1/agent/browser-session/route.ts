import { NextResponse, type NextRequest } from "next/server";
import { authenticateAgent, AgentAuthError } from "@/lib/agent/auth";
import { runTool } from "@/lib/agent/tools";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const ctx = await authenticateAgent(req, "api");
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(await runTool(ctx, "open_sfb_dashboard", body, req, "api"));
  } catch (e) {
    if (e instanceof AgentAuthError) return NextResponse.json({ error: e.code, error_description: e.message }, { status: e.status, headers: e.extraHeaders });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
