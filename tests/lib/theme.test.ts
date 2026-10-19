import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolveTheme, THEME_INIT_SCRIPT, THEME_KEY, DEFAULT_THEME } from "../../lib/theme";

test("theme: stored preference wins; system follows the OS; garbage falls back to the default (dark)", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", false), "dark");
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
  assert.equal(resolveTheme("purple", false), DEFAULT_THEME);
  assert.equal(resolveTheme(null, false), DEFAULT_THEME);
  assert.equal(DEFAULT_THEME, "dark", "first-time visitors keep the brand's dark look until they choose otherwise");
});

test("theme: the head script is self-contained, names the key, sets data-theme and never throws", () => {
  assert.ok(THEME_INIT_SCRIPT.includes(THEME_KEY));
  assert.ok(THEME_INIT_SCRIPT.includes("data-theme"));
  assert.ok(THEME_INIT_SCRIPT.includes("prefers-color-scheme: dark"));
  assert.ok(/^\(function\(\)\{try\{/.test(THEME_INIT_SCRIPT) && /catch\(e\)\{/.test(THEME_INIT_SCRIPT));
  // It must parse as plain JS (no template literal leftovers).
  assert.doesNotThrow(() => new Function(THEME_INIT_SCRIPT));
});

test("theme: the generated token sheet carries both sets and the Tailwind-mapped tokens exist", () => {
  const css = readFileSync("app/theme-tokens.css", "utf8");
  assert.ok(css.includes('html[data-theme="dark"]') && css.includes('html[data-theme="light"]'));
  assert.ok(css.includes('[data-authored="light"]') && css.includes('[data-theme-lock="dark"]'));
  for (const t of ["--w:", "--k:", "--n-50:", "--n-900:", "--hx-f5f5f7:", "--hx-1d1d1f:", "--hx-86868b:"]) assert.equal((css.match(new RegExp(t.replace(/[-:]/g, (c) => "\\" + c), "g")) ?? []).length, 2, `${t} in both sets`);
  // Inversion sanity: the page background flips, the key accent gets a light-mode variant that is not the same color.
  const normal = css.slice(0, css.indexOf('html[data-theme="light"],')); const inverted = css.slice(css.indexOf('html[data-theme="light"],'));
  assert.match(normal, /--w: 255 255 255;/); assert.match(inverted, /--w: 0 0 0;/);
  assert.match(normal, /--hx-30d158: #30D158;/); assert.doesNotMatch(inverted, /--hx-30d158: #30D158;/);
});

test("theme: no literal palette colors remain in app/ or components/ (run node scripts/theme-tokens.mjs)", () => {
  const r = spawnSync(process.execPath, ["scripts/theme-tokens.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr || r.stdout);
});
