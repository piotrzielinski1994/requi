// A path param is `:name` in the URL: a colon followed by a letter/underscore then
// word chars. The first-char rule keeps the scheme separator (`https://`) and a
// `:8080` port (digit after the colon) out, and `{{var}}` tokens never match.
const PATH_PARAM = /:([A-Za-z_]\w*)/g;

// Distinct param names (colon stripped) in first-appearance order.
export function extractPathParams(url: string): string[] {
  const seen = new Set<string>();
  for (const match of url.matchAll(PATH_PARAM)) {
    seen.add(match[1]);
  }
  return [...seen];
}

// Replace each `:name` whose (interpolated) value is a non-empty string with that
// value at every occurrence; leave the rest literal. `subst` resolves {{tokens}}
// in the value before it lands in the URL.
export function applyPathParams(
  url: string,
  values: Record<string, string>,
  subst: (input: string) => string,
): string {
  return url.replace(PATH_PARAM, (literal, name: string) => {
    const raw = values[name];
    if (raw === undefined) {
      return literal;
    }
    const resolved = subst(raw);
    return resolved === "" ? literal : resolved;
  });
}
