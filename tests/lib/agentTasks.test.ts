import { test } from "node:test";
import assert from "node:assert/strict";
import { agentHandleForClient, isAgentHandle } from "../../lib/agent/tasks/queue";
import { TASK_TOOLS } from "../../lib/agent/tasks/tools";
import { negotiateScopes } from "../../lib/agent/scopes";

test("agent identity derives from the OAuth client, Muse is Atlas", () => {
  assert.equal(agentHandleForClient("Muse"), "atlas");
  assert.equal(agentHandleForClient("Hyperagent"), "hyperagent");
  assert.equal(isAgentHandle("roman"), true);
  assert.equal(isAgentHandle("someone"), false);
});

test("task tools: the five required verbs exist, all under sfb:tasks, reads flagged read-only", () => {
  const names = TASK_TOOLS.map((t) => t.name);
  for (const n of ["create_task", "list_tasks", "claim_task", "post_result", "send_message", "review_task"]) assert.ok(names.includes(n), n);
  assert.ok(TASK_TOOLS.every((t) => t.scope === "sfb:tasks"));
  assert.deepEqual(TASK_TOOLS.filter((t) => t.readOnly).map((t) => t.name).sort(), ["get_task", "inbox", "list_tasks"]);
});

test("sfb:tasks is grantable and part of the default grant", () => {
  assert.ok(negotiateScopes(undefined).granted.includes("sfb:tasks"));
  assert.ok(negotiateScopes("sfb:tasks").granted.includes("sfb:tasks"));
});

import { canManageTask, UPDATABLE_STATUSES, TASK_STATUSES, DEFAULT_OWNER_AGENT } from "../../lib/agent/tasks/queue";
import { handleMcp } from "../../lib/agent/mcp";
import { TOOLS } from "../../lib/agent/tools";
import type { AgentContext } from "../../lib/agent/auth";
import type { NextRequest } from "next/server";

test("close_task / update_task exist, are write tools under sfb:tasks, and create_task no longer requires owner_agent (defaults to atlas)", () => {
  const byName = Object.fromEntries(TASK_TOOLS.map((t) => [t.name, t]));
  assert.ok(byName.close_task && byName.close_task.readOnly === false && byName.close_task.scope === "sfb:tasks");
  assert.ok(byName.update_task && byName.update_task.readOnly === false && byName.update_task.scope === "sfb:tasks");
  assert.deepEqual((byName.create_task.inputSchema as { required: string[] }).required, ["title"]);
  assert.equal(DEFAULT_OWNER_AGENT, "atlas");
  assert.ok(TASK_STATUSES.includes("closed")); assert.ok(!UPDATABLE_STATUSES.includes("done"), "done is only reachable through review_task");
});

test("permission rule (Roman 2026-10-11): only the roman handle overrides; Atlas is held to assignee/unassigned like everyone else", () => {
  const hyper = { owner_agent: "hyperagent" as const, claimed_by: null };
  assert.equal(canManageTask({ handle: "roman" }, hyper), true, "Roman may close anything");
  assert.equal(canManageTask({ handle: "atlas" }, hyper), false, "Atlas may NOT close HyperAgent's task — even though its authorization is Roman's account");
  assert.equal(canManageTask({ handle: "hyperagent" }, hyper), true, "assignee");
  assert.equal(canManageTask({ handle: "atlas" }, { owner_agent: "atlas", claimed_by: null }), true, "its own task");
  assert.equal(canManageTask({ handle: "atlas" }, { owner_agent: "hyperagent", claimed_by: "atlas" }), true, "claimer");
  assert.equal(canManageTask({ handle: "atlas" }, { owner_agent: null as unknown as "atlas", claimed_by: null }), true, "unassigned");
});

test("tools/list advertises EVERY task tool to a connection holding sfb:tasks (no hidden callables)", async () => {
  const scopes = new Set(["sfb:workspace:read", "sfb:tasks"]);
  const ctx = { authorization: { id: "a", user_id: "u", client_id: "test", workspace_label: "SFB Connect Team", scopes: [...scopes], status: "active", delegated_refresh_enc: null, delegated_access_enc: null, delegated_access_expires_at: null, created_at: "", revoked_at: null, last_used_at: null }, user: {} as never, scopes, clientId: "test", userId: "u" } as unknown as AgentContext;
  const r = (await handleMcp(ctx, { jsonrpc: "2.0", id: 1, method: "tools/list" }, {} as NextRequest)) as { result: { tools: { name: string }[] } };
  const listed = new Set(r.result.tools.map((t) => t.name));
  for (const t of TASK_TOOLS) assert.ok(listed.has(t.name), `${t.name} must be listed`);
  for (const n of ["list_tasks", "create_task", "claim_task", "close_task", "update_task", "inbox", "get_task", "start_task", "post_result", "review_task", "cancel_task", "send_message"]) assert.ok(listed.has(n), n);
  // Every callable tool whose scope is granted is listed — nothing is callable but hidden.
  const callable = TOOLS.filter((t) => scopes.has(t.scope)).map((t) => t.name).sort();
  assert.deepEqual([...listed].sort(), callable);
});
