# Runbook — Light / dark theme (everything)

Roman, 2026-10-18: light and dark mode for the public site, the team dashboard and the customer portal. Built as **theme-relative color tokens**, not a second stylesheet.

## How it works
| Piece | Where |
|---|---|
| Theme state | `html[data-theme="dark"\|"light"]` + `html[data-theme-pref="dark"\|"light"\|"system"]`, set **before first paint** by the inline script in `app/layout.tsx` (`THEME_INIT_SCRIPT`, `lib/theme.ts`). Order: `localStorage["sfb-theme"]` → cookie `sfb-theme` → `DEFAULT_THEME` (**dark** — first-time visitors see the brand look; change the constant to `"system"` to follow the OS). No server cookie read, so static pages stay static. |
| Tokens | `app/theme-tokens.css` — **generated** by `node scripts/theme-tokens.mjs`. One custom property per color the code uses (`--hx-f5f5f7`, plus `--hx-…c` = RGB channels for alpha), `--w` / `--k` channels for white/black, `--n-50…950` for the Tailwind neutral scale. Two sets: **normal** (as authored) and **inverted** (grays: lightness flipped; chromatic accents moved to the band that reads on the opposite background). |
| Which set applies | *Normal* on `html[data-theme="dark"]`, on `html[data-theme="light"] [data-authored="light"]`, and inside any `[data-theme-lock="dark"]`. *Inverted* on `html[data-theme="light"]` and on `html[data-theme="dark"] [data-authored="light"]`. In words: **a surface shows its authored colors when the theme matches the register it was written in, and the inverted set otherwise.** |
| Registers | Dark-authored (default): public site, `/start`, `/login`, team dashboard, admin. Light-authored (`data-authored="light"`): `components/customerPortal/PortalShell.tsx`, `/dashboard/no-membership`, `/dashboard/google-not-cleared`. |
| Locks | `data-theme-lock="dark"` on the Hero (video background) and the neon "What we analyze" cards — they keep their cinematic dark look in light mode. The Hero's bottom fade ends in `--page-bg` (set in `globals.css`, *not* in the generated block) so it blends into whatever follows. |
| Tailwind | `tailwind.config.ts`: `white`, `black`, `neutral.*`, `soft-white`, `dark-gray`, `medium-gray`, `border` resolve through the tokens with `<alpha-value>`, so `text-white/[0.55]`, `bg-black`, `text-neutral-900` all flip automatically. |
| Toggle | `components/ThemeToggle.tsx` — compact (cycles Dark → Light → System) in the public Navbar (desktop + mobile menu), the team sidebar footer, the customer portal sidebar; full segmented control in `/team/settings` → Appearance. Persists to localStorage + cookie (1 year). |
| Images | A white-on-transparent mark gets `class="theme-invert"` (nav logo) and is CSS-inverted whenever its surface shows the inverted set. Brand logos (integrations, customer logos) are left alone. |
| Tests | `tests/lib/theme.test.ts` — resolution rules, script sanity, token sheet has both sets, and **`--check` fails the suite if any literal palette color is added to `app/` or `components/`**. |

## Adding or changing colors (the only rule)
Write the literal you want (`#1C1C1E`, `rgba(255,255,255,0.08)`), then run `node scripts/theme-tokens.mjs`. It rewrites your literal to a token and adds the token (with its inverted value) to the sheet. Commit both. The test suite enforces this. Never hand-edit `app/theme-tokens.css`.

Exceptions the codemod deliberately skips: SVG / recharts presentation attributes (`stroke="#…"`, `fill="#…"`, `stopColor`, `color="#…"` props) because `var()` is not valid there; `app/opengraph-image.tsx` (no CSS at render); `app/api/**` (HTML emails). Black `box-shadow` / `text-shadow` values stay black on purpose.

## Operate / debug
- A page looks wrong in one theme only: check which register it is in. A light-authored page nested outside `PortalShell` needs `data-authored="light"` on its root; a photo/video block that must stay dark needs `data-theme-lock="dark"`.
- "Colors didn't change after my edit": you edited a literal — run the generator.
- Charts: recharts series colors are literal accents and read fine on both backgrounds; axis/grid grays are mid-tones. Not theme-switched (attribute colors can't use `var()`).
- Flash of wrong theme: the head script runs synchronously; if it ever fails, the `<html data-theme="dark">` default applies.
