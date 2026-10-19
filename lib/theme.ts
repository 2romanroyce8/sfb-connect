// Light/dark theme (Roman, 2026-10-18). Pure helpers shared by the no-flash head
// script (inlined as a string so it runs before first paint), the toggle, and tests.
// Default for a first-time visitor is DARK — the brand look stays unless the visitor
// picks Light or System. Flip DEFAULT_THEME to "system" to follow the OS instead.
export type Theme = "dark" | "light";
export type ThemePreference = Theme | "system";
export const THEME_KEY = "sfb-theme";
export const DEFAULT_THEME: ThemePreference = "dark";

export const isTheme = (v: unknown): v is Theme => v === "dark" || v === "light";
export const isPreference = (v: unknown): v is ThemePreference => isTheme(v) || v === "system";

/** Pure: what the document should render, given the stored preference and the OS setting. */
export function resolveTheme(pref: unknown, systemPrefersDark: boolean): Theme {
  const p = isPreference(pref) ? pref : DEFAULT_THEME;
  if (p === "system") return systemPrefersDark ? "dark" : "light";
  return p;
}

/** Inline <head> script: sets data-theme before paint. Reads localStorage, then the cookie, then DEFAULT_THEME. Never throws. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_KEY)};var d=${JSON.stringify(DEFAULT_THEME)};var p=null;try{p=localStorage.getItem(k)}catch(e){}if(!p){var m=document.cookie.match(/(?:^|; )${THEME_KEY}=(light|dark|system)/);p=m?m[1]:null}if(p!=='light'&&p!=='dark'&&p!=='system')p=d;var t=p==='system'?(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;var h=document.documentElement;h.setAttribute('data-theme',t);h.setAttribute('data-theme-pref',p);h.style.colorScheme=t}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

/** Client: persist and apply a preference. Cookie mirrors localStorage so the choice survives a cleared storage and is readable server-side if ever needed. */
export function applyPreference(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const systemDark = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const t = resolveTheme(pref, systemDark);
  const h = document.documentElement;
  h.setAttribute("data-theme", t); h.setAttribute("data-theme-pref", pref); h.style.colorScheme = t;
  try { localStorage.setItem(THEME_KEY, pref); } catch { /* storage blocked — cookie still works */ }
  document.cookie = `${THEME_KEY}=${pref}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function readPreference(): ThemePreference {
  if (typeof document === "undefined") return DEFAULT_THEME;
  const attr = document.documentElement.getAttribute("data-theme-pref");
  if (isPreference(attr)) return attr;
  try { const v = localStorage.getItem(THEME_KEY); if (isPreference(v)) return v; } catch { /* ignore */ }
  return DEFAULT_THEME;
}
