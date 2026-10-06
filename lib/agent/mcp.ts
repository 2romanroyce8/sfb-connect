import type { NextRequest } from "next/server";
import { TOOLS, runTool } from "./tools";
import { AgentAuthError, type AgentContext } from "./auth";

// Minimal, spec-shaped MCP server over Streamable HTTP (JSON responses).
// Supported: initialize, notifications/initialized, ping, tools/list,
// tools/call. Resources/prompts are not offered.
export const MCP_PROTOCOL_VERSION = "2025-06-18";
type Rpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

export function rpcError(id: string | number | null | undefined, code: number, message: string, data?: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

export async function handleMcp(ctx: AgentContext, body: Rpc, req: NextRequest) {
  const id = body.id;
  switch (body.method) {
    case "initialize":
      return { jsonrpc: "2.0", id, result: { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: { name: "sfb-connect", version: "1.0.0" }, instructions: `Connected to SFB Connect as ${ctx.authorization.workspace_label} (${[...ctx.scopes].join(" ")}). Use structured tools for data; use open_sfb_dashboard only when the user wants the real dashboard opened or no tool covers the task. Read-only.` } };
    case "notifications/initialized":
      return null; // notification: no response body
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS.filter((t) => ctx.scopes.has(t.scope)).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, outputSchema: t.outputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } })) } };
    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await runTool(ctx, name, args, req, "mcp");
        return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out, isError: false } };
      } catch (e) {
        const err = e as AgentAuthError;
        if (err instanceof AgentAuthError) return { jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `${err.code}: ${err.message}` }], isError: true } };
        return rpcError(id, -32603, "Internal error");
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${body.method}`);
  }
}
