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
