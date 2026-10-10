import { test } from "node:test";
import assert from "node:assert/strict";
import { sortCards, type GridCard } from "../../components/team/IntegrationsGrid";

const c = (key: string, status: GridCard["status"], connected = false): GridCard => ({ key, name: key, logo: "x", status, connectKind: "oauth", connected, configured: true, accountLabel: null });

test("grid sorts connected first, then live, then needs setup, parked last", () => {
  const out = sortCards([c("meta", "needs_setup"), c("gohighlevel", "planned"), c("stripe", "live"), c("gmail", "live", true), c("slack", "needs_setup")]).map((x) => x.key);
  assert.deepEqual(out, ["gmail", "stripe", "meta", "slack", "gohighlevel"]);
});
