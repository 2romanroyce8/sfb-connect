import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutGraph, nodeId, parseTechStack, clientSafeGraph, graphBounds, initialsOf, type ProjectGraph } from "../../lib/projects/graph";

const g = (): ProjectGraph => ({
  project: { id: "p1", business_id: "b1", name: "Website", status: "active", summary: null, positions: {}, created_at: "2026-10-11T00:00:00Z", updated_at: "" },
  client: { id: "b1", name: "SaaSflow", logo_url: null, onboarded_at: "2026-06-25T00:00:00Z", slug: "saasflow", plan_key: "solo" },
  tasks: [
    { id: "t1", project_id: "p1", title: "Web Design", description: null, status: "in_progress", assignees: ["u1"], tech_stack: ["Figma"], internal_note: "margin is thin", client_approval: "pending", client_approval_note: null, client_approved_at: null, sort_order: 0, created_at: "2026-10-11T00:00:01Z", updated_at: "", subtasks: [{ id: "s1", task_id: "t1", title: "Create wireframe", done: false, assignees: [], tech_stack: [], sort_order: 0, created_at: "", updated_at: "" }] },
    { id: "t2", project_id: "p1", title: "Launch", description: null, status: "planned", assignees: [], tech_stack: [], internal_note: null, client_approval: "not_requested", client_approval_note: null, client_approved_at: null, sort_order: 1, created_at: "2026-10-11T00:00:02Z", updated_at: "", subtasks: [] },
  ],
  notes: [{ id: "n1", project_id: "p1", task_id: "t1", body: "Prefer blue", author_kind: "client", author_id: null, created_at: "", updated_at: "" }],
  roles: [{ id: "r1", project_id: "p1", task_id: "t1", role_title: "Project Manager", person_user_id: "u1", person_name: null, blurb: "Managing project progress", tech_stack: [], sort_order: 0, created_at: "", updated_at: "" }, { id: "r2", project_id: "p1", task_id: "t1", role_title: "UX Designer", person_user_id: null, person_name: "Dana", blurb: null, tech_stack: ["Figma"], sort_order: 1, created_at: "", updated_at: "" }],
  people: [{ id: "u1", name: "Roman Royce", avatar_url: null }],
});

test("layout: client on top, one column per task, subtasks dashed below-left, notes right, roles chained with an 'Assigned roles' label", () => {
  const { nodes, edges } = layoutGraph(g());
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  assert.ok(byId.client && byId.client.y === 0, "client at the top");
  assert.ok(byId["task:t1"].y > byId.client.y && byId["task:t2"].x > byId["task:t1"].x, "tasks in a row under the client");
  assert.ok(byId["subtasks:t1"].y > byId["task:t1"].y && byId["subtasks:t1"].x < byId["task:t1"].x, "subtasks below-left");
  assert.ok(byId["notes:t1"].x > byId["task:t1"].x, "notes to the right");
  assert.ok(!byId["subtasks:t2"] && !byId["notes:t2"], "no empty nodes: a task without subtasks/notes gets none");
  const e = Object.fromEntries(edges.map((x) => [x.id, x]));
  assert.equal(e["e:task:t1-sub"].style, "dashed"); assert.equal(e["e:client-task:t1"].style, "solid"); assert.equal(e["e:task:t1-notes"].style, "solid");
  assert.equal(e["e:task:t1-role:r1"].label, "Assigned roles"); assert.equal(e["e:task:t1-role:r2"].from, "role:r1", "roles chain vertically");
  assert.deepEqual(layoutGraph(g()).nodes, nodes, "deterministic");
});

test("layout: dragged positions win and are flagged non-auto; bounds cover every node", () => {
  const graph = g(); graph.project.positions = { "task:t1": { x: 999, y: 777 } };
  const { nodes } = layoutGraph(graph);
  const t1 = nodes.find((n) => n.id === nodeId.task("t1"))!;
  assert.equal(t1.x, 999); assert.equal(t1.y, 777); assert.equal(t1.auto, false);
  assert.equal(nodes.find((n) => n.id === "client")!.auto, true);
  const b = graphBounds(nodes); assert.ok(b.maxX >= 999 + t1.w && b.minY === 0);
});

test("tech stack parsing + initials + client-safe projection drops internal_note only", () => {
  assert.deepEqual(parseTechStack("Figma, Next.js,  figma ,Supabase\nStripe"), ["Figma", "Next.js", "Supabase", "Stripe"]);
  assert.deepEqual(parseTechStack(["A", "", "B"]), ["A", "B"]); assert.deepEqual(parseTechStack(42), []);
  assert.equal(initialsOf("Roman Royce"), "RR"); assert.equal(initialsOf("dana"), "D");
  const safe = clientSafeGraph(g());
  assert.ok(!("internal_note" in safe.tasks[0]), "internal-only field removed");
  assert.equal(safe.tasks[0].client_approval, "pending"); assert.equal(safe.notes.length, 1); assert.equal(safe.roles.length, 2);
});
