import { test } from "node:test";
import assert from "node:assert/strict";
import { sortCards, type GridCard } from "../../components/team/IntegrationsGrid";

const c = (key: string, status: GridCard["status"], connected = false): GridCard => ({ key, name: key, logo: "x", status, connectKind: "oauth", connected, configured: true, accountLabel: null });

test("grid sorts connected first, then live, then needs setup, parked last", () => {
  const out = sortCards([c("meta", "needs_setup"), c("gohighlevel", "planned"), c("stripe", "live"), c("gmail", "live", true), c("slack", "needs_setup")]).map((x) => x.key);
  assert.deepEqual(out, ["gmail", "stripe", "meta", "slack", "gohighlevel"]);
});

import { cardAction } from "../../components/team/IntegrationsGrid";

test("one action per card: Connect / Manage / Configured; parked gets none", () => {
  const base = { name: "x", logo: "x", accountLabel: null, configured: true, connected: false } as const;
  assert.deepEqual(cardAction({ ...base, key: "resend", status: "live", connectKind: "system" }), { label: "Configured", href: null });
  assert.equal(cardAction({ ...base, key: "gohighlevel", status: "planned", connectKind: "oauth" }), null);
  assert.deepEqual(cardAction({ ...base, key: "slack", status: "live", connectKind: "oauth", connected: true }), { label: "Manage", href: "/team/integrations?manage=slack" });
  assert.deepEqual(cardAction({ ...base, key: "meta", status: "needs_setup", connectKind: "oauth" }), { label: "Connect", href: "/api/team/integrations/meta/connect" });
  assert.deepEqual(cardAction({ ...base, key: "meta", status: "needs_setup", connectKind: "oauth", configured: false }), { label: "Set up", href: "/team/integrations?manage=meta" });
  assert.deepEqual(cardAction({ ...base, key: "zapier", status: "live", connectKind: "zapier_key" }), { label: "Manage", href: "/team/integrations?manage=zapier" });
  assert.deepEqual(cardAction({ ...base, key: "webhooks", status: "live", connectKind: "webhooks" }), { label: "Manage", href: "/team/integrations?manage=webhooks" });
});
