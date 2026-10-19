#!/usr/bin/env node
// Theme token generator + codemod (Roman, 2026-10-18: light/dark for everything).
//
// What it does, deterministically, so it can be re-run any time new colors land:
//   1. Scans app/ and components/ (*.tsx) plus app/globals.css for literal colors.
//   2. For every distinct hex it emits a CSS custom property in app/theme-tokens.css with
//      a NORMAL value (the literal, as authored) and an INVERTED value (lightness flipped;
//      chromatic accents re-tuned for the opposite background).
//   3. Rewrites the files so they reference the tokens instead of the literals.
//
// The token sets are selected by html[data-theme] × [data-authored] (see theme-tokens.css
// header). Run:  node scripts/theme-tokens.mjs            (generate + rewrite)
//               node scripts/theme-tokens.mjs --check    (fail if any literal remains)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SCAN_DIRS = ["app", "components"];
// Never rewrite: OG image (ImageResponse has no CSS vars), API routes (HTML emails/strings), SVG/recharts attribute colors are skipped per line.
const EXCLUDE = [/^app\/api\//, /^app\/opengraph-image\.tsx$/, /^app\/theme-tokens\.css$/];
const CHECK = process.argv.includes("--check");

// ---------- color math ----------
const hex6 = (h) => { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); return h.toUpperCase(); };
const toRgb = (h) => { const x = hex6(h); return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)); };
const toHex = ([r, g, b]) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase();
function rgbToHsl([r, g, b]) { r /= 255; g /= 255; b /= 255; const max = Math.max(r, g, b), min = Math.min(r, g, b); const l = (max + min) / 2; if (max === min) return [0, 0, l]; const d = max - min; const s = l > 0.5 ? d / (2 - max - min) : d / (max + min); let h = 0; if (max === r) h = (g - b) / d + (g < b ? 6 : 0); else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; return [h / 6, s, l]; }
function hslToRgb([h, s, l]) { if (s === 0) return [l * 255, l * 255, l * 255]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q; const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]; }
/** Inverted value: grays flip lightness exactly; chromatic accents move to the lightness band that reads on the opposite background. */
function invert(hex) {
  const [h, s, l] = rgbToHsl(toRgb(hex));
  if (s < 0.12) return toHex(hslToRgb([h, s, 1 - l]));
  const l2 = l >= 0.5 ? 0.38 : 0.64; // light accent on dark → deep accent on light; dark accent on light → bright accent on dark
  return toHex(hslToRgb([h, Math.min(1, s), l2]));
}
const tokenName = (hex) => `--hx-${hex6(hex).toLowerCase()}`;

// ---------- scan ----------
function walk(dir, out = []) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (/\.tsx$/.test(e.name)) out.push(p); } return out; }
const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((p) => path.relative(ROOT, p)).filter((rel) => !EXCLUDE.some((re) => re.test(rel)));
files.push("app/globals.css");

const HEX_RE = /#(?:[0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})\b/g;
const SKIP_LINE = /(?:stroke|fill|stopColor|floodColor|color)=["']#|<linearGradient|<stop\b|<radialGradient/; // SVG/recharts presentation attributes: var() is not valid there
const SHADOW_LINE = /boxShadow|box-shadow|textShadow|text-shadow|dropShadow|drop-shadow/;

const seen = new Map();
let leftovers = [];
for (const rel of files) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  // Idempotent: tokens already referenced in the file stay in the sheet on every run.
  for (const m of src.matchAll(/--hx-([0-9a-f]{6})\b/g)) seen.set(m[1].toUpperCase(), (seen.get(m[1].toUpperCase()) ?? 0) + 1);
  const lines = src.split("\n");
  const out = lines.map((line, i) => {
    if (SKIP_LINE.test(line)) return line;
    let l = line;
    // Tailwind arbitrary hex with opacity suffix: text-[#FFD60A]/80 → text-[color:rgb(var(--hxc-ffd60a)/0.8)]
    l = l.replace(/(bg|text|border|from|via|to|ring|outline|decoration|placeholder|divide|accent|caret)-\[(#[0-9A-Fa-f]{3,6})\]\/(\d{1,3})\b/g, (_, u, h, a) => { seen.set(hex6(h), (seen.get(hex6(h)) ?? 0) + 1); return `${u}-[color:rgb(var(${tokenName(h)}c)/${Number(a) / 100})]`; });
    // Tailwind arbitrary hex: text-[#F5F5F7] → text-[color:var(--hx-f5f5f7)]
    l = l.replace(/(bg|text|border|from|via|to|ring|outline|decoration|placeholder|divide|accent|caret)-\[(#[0-9A-Fa-f]{3,6})\]/g, (_, u, h) => { seen.set(hex6(h), (seen.get(hex6(h)) ?? 0) + 1); return `${u}-[color:var(${tokenName(h)})]`; });
    // rgba whites/blacks → channel tokens (black shadows stay literal: a shadow must not turn white in light mode)
    l = l.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([0-9.]+)\s*\)/g, (_, a) => `rgb(var(--w) / ${a})`);
    if (!SHADOW_LINE.test(l)) l = l.replace(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([0-9.]+)\s*\)/g, (_, a) => `rgb(var(--k) / ${a})`);
    // Remaining literal hex (inline styles, CSS, style consts) → var()
    l = l.replace(HEX_RE, (h) => { seen.set(hex6(h), (seen.get(hex6(h)) ?? 0) + 1); return `var(${tokenName(h)})`; });
    return l;
  });
  const rewritten = out.join("\n");
  if (CHECK) { if (rewritten !== src) leftovers.push(rel); continue; }
  if (rewritten !== src) fs.writeFileSync(path.join(ROOT, rel), rewritten);
}

if (CHECK) {
  if (leftovers.length) { console.error("Literal colors found (run node scripts/theme-tokens.mjs):\n  " + leftovers.join("\n  ")); process.exit(1); }
  console.log("theme check: clean"); process.exit(0);
}

// ---------- emit tokens ----------
// Colors referenced only from tailwind.config.ts / globals (never as literals in TSX) must still exist as tokens.
for (const h of ["86868B", "1D1D1F", "F5F5F7", "000000", "FFFFFF"]) if (!seen.has(h)) seen.set(h, 0);
const hexes = [...seen.keys()].sort();
const NEUTRAL = { 50: "#FAFAFA", 100: "#F5F5F5", 200: "#E5E5E5", 300: "#D4D4D4", 400: "#A3A3A3", 500: "#737373", 600: "#525252", 700: "#404040", 800: "#262626", 900: "#171717", 950: "#0A0A0A" };
const ch = (hex) => toRgb(hex).join(" ");
const block = (inverted) => {
  const lines = [];
  lines.push(`  --w: ${inverted ? "0 0 0" : "255 255 255"};`);
  lines.push(`  --k: ${inverted ? "255 255 255" : "0 0 0"};`);
  const keys = Object.keys(NEUTRAL).map(Number);
  for (const k of keys) { const src = inverted ? NEUTRAL[1000 - k] ?? NEUTRAL[k] : NEUTRAL[k]; lines.push(`  --n-${k}: ${ch(k === 500 ? NEUTRAL[500] : src)};`); }
  for (const h of hexes) { const v = inverted ? invert(h) : `#${h}`; lines.push(`  ${tokenName(h)}: ${v};`); lines.push(`  ${tokenName(h)}c: ${ch(v)};`); }
  return lines.join("\n");
};
const css = `/* GENERATED by scripts/theme-tokens.mjs — do not edit by hand. ${hexes.length} colors.
   Selection rule: a surface shows its AUTHORED colors when the theme matches its register and the
   INVERTED set when it doesn't. Public site + team dashboard are dark-authored (default);
   wrap light-authored surfaces (customer dashboard) in [data-authored="light"].
   [data-theme-lock="dark"] pins a subtree (video/photo backgrounds) to its authored dark colors. */
:root,
html[data-theme="dark"],
html[data-theme="light"] [data-authored="light"],
html[data-theme] [data-theme-lock="dark"] {
${block(false)}
}
html[data-theme="light"],
html[data-theme="dark"] [data-authored="light"] {
${block(true)}
}
`;
fs.writeFileSync(path.join(ROOT, "app/theme-tokens.css"), css);
console.log(`tokens: ${hexes.length} colors → app/theme-tokens.css; files scanned: ${files.length}`);
