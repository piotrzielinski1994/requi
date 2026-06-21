// Derive a request's display name from its URL, with any query/hash dropped.
// Matches the workspace convention where a request's name is its path (e.g.
// `{{baseUrl}}/billing/invoices` -> `/billing/invoices`). When a `{{var}}` base
// prefix or scheme+host IS stripped, only the path part (from the first `/`) is
// kept - so a prefix-only URL with no path yields "" (caller keeps the default).
// When NO prefix is present, the bare string is used verbatim (the user is
// typing a name/path directly, e.g. "asds").
export function deriveRequestName(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") {
    return "";
  }
  const withoutQuery = trimmed.split(/[?#]/)[0];
  const afterVar = withoutQuery.replace(/^\{\{[^}]*\}\}/, "");
  const afterPrefix = afterVar.replace(/^[a-zA-Z][\w+.-]*:\/\/[^/]*/, "");
  const hadPrefix = afterPrefix !== withoutQuery;
  if (!hadPrefix) {
    return afterPrefix;
  }
  const slashIndex = afterPrefix.indexOf("/");
  if (slashIndex === -1) {
    return "";
  }
  return afterPrefix.slice(slashIndex);
}
