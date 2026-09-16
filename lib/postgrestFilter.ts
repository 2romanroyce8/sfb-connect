// Shared helper for building safe PostgREST .or()/.and() filter values.
//
// PostgREST's or=() syntax uses commas as the top-level clause separator
// and parentheses for grouping. Interpolating a raw, unescaped value into a
// filter string means ANY comma or unbalanced parenthesis in that value can
// corrupt the whole filter, returning a PGRST100 parse error (HTTP 400) --
// this is exactly what broke /api/team/search for a term as ordinary as
// "Roofing, LLC". Wrapping the value in double quotes is PostgREST's own
// escape mechanism for reserved characters inside a filter value; any
// literal backslash or double-quote in the value must itself be
// backslash-escaped so it doesn't terminate the quoted value early.
export function toOrFilterValue(raw: string): string {
  const escaped = raw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}
