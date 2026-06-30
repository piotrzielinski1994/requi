# Plan - Path & Query params as separate sub-tabs

## Approach

Two independent param namespaces, surfaced under a sub-bar inside the existing **Params** tab:

- **Query** = today's `config.params` (inherited `KeyValue[]`). No data/behaviour change; only
  the tab label and nesting move. Reuse `ParamsPanel` / `EditableKeyValueTable` verbatim.
- **Path** = new request-only `RequestNode.pathParams?: Record<string,string>`, surfaced as an
  **editable key->value grid** (reuse `EditableKeyValueTable` like `VarsPanel` - editable keys
  AND values, trailing blank, delete, no enable toggle). Rows = ordered union of the URL's
  `:name` tokens and the stored `pathParams` keys, so a param can be defined in the grid OR in
  the URL (Bruno-style sync). Send-time substitution replaces each `:name` by its interpolated
  value, leaving empty/unfilled tokens literal.

Key derivation lives in a pure helper `extractPathParams(url): string[]` (regex
`/:([A-Za-z_]\w*)/g`, deduped, first-appearance order) - shared by the Path panel (to compute
the URL part of the row union), `build-request.ts` (to substitute), and the context's
delta-prune (to detect which `:name` LEFT the URL on an edit). Single source of truth, no drift.

Why request-only (not `ConfigScope`): a path slot is intrinsic to one URL; inheriting `:id`
across sibling requests with different paths is meaningless. Keeps `EffectiveConfig`/resolve
untouched. (Decision logged.)

## File changes

### Model + persistence

1. `src/lib/workspace/model.ts`
   - `RequestNode`: add `pathParams?: Record<string, string>;` (after `bodyForm`).

2. `src/lib/workspace/disk-format.ts`
   - `ParsedRequest`: add `pathParams?: Record<string, unknown>`.
   - New `sanitizePathParams(value): { pathParams: Record<string,string> } | undefined` -
     object guard, keep only string values, drop field if empty/non-object (mirror
     `sanitizeEnvironmentColors`).
   - `serializeInto` request branch: emit `pathParams` only when non-empty.
   - `parseRequest`: spread sanitized `pathParams` into the node.

### Path extraction + send-time substitution

3. New `src/lib/http/path-params.ts`
   - `export function extractPathParams(url: string): string[]` - regex match, dedupe preserving
     order. Pure, no deps.
   - `export function applyPathParams(url, values, subst): string` - replace each `:name` whose
     `values[name]` is a non-empty (post-`subst`) string; leave others literal. Uses the same
     regex so detection and substitution agree.

4. `src/lib/http/build-request.ts`
   - Before `appendParams(subst(node.url), params)`, run
     `applyPathParams(node.url, node.pathParams ?? {}, subst)` then `subst` the result for
     `{{var}}` in the rest of the URL, then `appendParams`. Order: path-substitute -> subst ->
     append query. (Path values are subst'd inside `applyPathParams`; the remaining URL still
     needs `subst` for `{{base}}` etc.)

### State / persistence wiring

5. `src/components/workspace/workspace-context.tsx`
   - `RequestOverride`: add `"pathParams"` to the `Pick`.
   - New action `setRequestPathParam(id, name, value)`: merge into `pathParams`, and on URL
     edits prune stale keys. Implementation: a `setRequestPathParams(id, next)` that
     `mergeOverride(id, { pathParams: next })`; the panel computes `next` from current + edit.
   - `setRequestUrl`: after setting url, prune `pathParams` to only keys still present via
     `extractPathParams(url)` (drop orphans, AC-005/E-6). Pull current pathParams from the
     effective request.
   - Expose `setRequestPathParams` in the context value + type.

### UI

6. New `src/components/workspace/path-params-panel.tsx`
   - `PathParamsPanel({ request, highlight })`: `extractPathParams(request.url)` -> rows. Empty
     array -> empty-state hint. Else a read-only-key / editable-value grid (mirror
     `EditableKeyValueTable` columns `1fr 1fr`, no toggle, no trailing blank, no delete - key is
     a static label, value is `HighlightedInput`). On value change call `setRequestPathParams`.

7. `src/components/workspace/params-sub-tabs.tsx` (or inline in `request-pane.tsx`)
   - A nested Radix `Tabs` (local `useState`, default `"query"`) with `PANE_TABS_LIST` /
     `PANE_TABS_TRIGGER` styling. Triggers: `Path`, `Query`. Content: `PathParamsPanel` /
     `ParamsPanel`. Render this in the `TabsContent value="params"` slot of `RequestTabs`.

8. `src/components/workspace/request-pane.tsx`
   - Rename the main trigger label `Params` stays as-is (tab key `params`); its content becomes
     the sub-tab component instead of `ParamsPanel` directly.

### Query <-> URL bidirectional sync (AC-011..AC-016)

9. New `src/lib/http/query-sync.ts` (pure):
   - `parseUrlQuery(url): KeyValue[]` - ordered raw pairs from the `?` part (no decoding, keeps
     `{{var}}`); bare key -> empty value.
   - `syncParamsFromUrl(prevUrl, nextUrl, rows): KeyValue[]` - URL drives the grid: URL keys ->
     enabled rows (add new / re-enable + value-sync existing); a key that LEFT the URL with a
     value -> disabled (kept); left with empty value -> dropped (typing cruft); non-URL rows
     untouched.
   - `syncUrlFromParams(url, rows): string` - grid drives the URL: enabled non-blank rows ->
     `?k=v&...` in grid order; base (path + `:pathParams`) preserved; empty -> strip `?`.

10. `src/lib/http/build-request.ts` - `appendParams` dedupes: skip a `config.params` key already
    in the URL query (URL value wins), so a mirrored param is sent once (AC-015).

11. `src/components/workspace/workspace-context.tsx`
    - `setRequestUrl`: also compute `syncQueryPatch` (URL->grid `config.params`), no-op-guarded so
      a path-only edit doesn't touch config; merged into the same override.
    - New `setRequestQueryParams(id, params)`: sets `config.params` AND `url =
      syncUrlFromParams(url, params)` (grid->URL); exposed in the context value + type.

12. `src/components/workspace/request-pane.tsx` - the Query sub-view's `onChange` routes through
    `setRequestQueryParams` (not the generic `setRequestConfig`) so a grid edit mirrors to the URL.

## Edge cases handled

- E-1 scheme/port: regex `:[A-Za-z_]\w*` - `://` and `:8080` never match (digit/slash after colon).
- E-2 repeat: `extractPathParams` dedupes; `applyPathParams` uses global regex so all occurrences
  replaced by the one value.
- E-3 empty: `applyPathParams` skips substitution when the post-`subst` value is empty -> literal.
- E-4 `{{var}}` in value: `subst` applied inside `applyPathParams`.
- E-6 orphan prune: `setRequestUrl` re-derives keys and drops the rest.
- E-7 disk garbage: `sanitizePathParams`.

## Tests to write (RED first)

- `src/lib/http/__tests__/path-params.test.ts` - `extractPathParams` (detect, dedupe, order,
  scheme/port guard, `{{var}}` coexistence); `applyPathParams` (substitute, repeat, empty-literal,
  `{{var}}` value). Maps: AC-006, AC-007, AC-009, TC-003/006/007/008/011/012.
- `src/lib/http/__tests__/build-request.test.ts` - extend: path + query together; empty path
  param stays literal. Maps: AC-006, AC-007.
- `src/lib/workspace/__tests__/disk-format.test.ts` - round-trip `pathParams`; absent when empty;
  sanitize non-string. Maps: AC-008, TC-010.
- Component test for the Params sub-bar + Path panel (mirror existing panel tests): sub-bar
  switches; Path rows from URL with read-only keys; empty-state hint; editing a value calls the
  setter; query sub-view still toggles a row. Maps: AC-001/002/003/004/010, TC-001/002/003/009.
- Context test (if a setter test file exists): `setRequestUrl` prunes orphan `pathParams`. AC-005.

## Execution order

1. RED: spawn test-writer subagent against this spec.
2. GREEN per AC: model -> disk-format -> path-params lib -> build-request -> context -> UI.
3. REFACTOR: dedupe regex constant, tighten types.
4. VERIFY: fresh verifier subagent (lint, typecheck, full vitest, project gates).

## Acceptance verification

Each AC maps to >=1 test above; verifier confirms test bodies assert behaviour (not tautology),
runs `npm run lint`, `npm run typecheck`, `npm test`, and adversarially probes the empty/repeat/
scheme-port edge cases.

## Status: DONE

All 16 ACs implemented + verified (fresh verifier subagent, no impl context). Gates:
tsc 0 errors, lint 0 errors (9 pre-existing warnings), vitest 1446/1446 pass.
AC-001..AC-010 = Path tab; AC-011..AC-016 = Query<->URL bidirectional sync.

### AC -> test traceability

| AC | Test |
| -- | ---- |
| AC-001 | path-params-panel.test.tsx "should show a Path/Query sub-bar with Query selected by default" + "...switch to the Path sub-view on click and back to Query" |
| AC-002 | path-params-panel.test.tsx "should persist enabled:false on config.params when a query row is toggled off and saved" |
| AC-003 | path-params-panel.test.tsx "should list a row per :name in first-appearance order with editable key cells" + "should show the editable grid (no hint) if the url has no path params"; path-params.test.ts detection block |
| AC-004 | path-params-panel.test.tsx "should persist a path-param value edit as pathParams[name] on save" + "should persist a grid-defined path param without touching the URL" |
| AC-005 | path-params-panel.test.tsx "should add a Path row when a :name is typed into the URL and drop it when removed" + "should prune a url-removed param on save but keep a grid-only param" |
| AC-006 | build-request-path-params.test.ts (substitution suite); path-params.test.ts applyPathParams block |
| AC-007 | build-request-path-params.test.ts "should keep the :name literal..." (empty + no-pathParams + filled/empty sibling) |
| AC-008 | disk-format-path-params.test.ts (round-trip, emit-when-non-empty, sanitize) |
| AC-009 | path-params.test.ts scheme/port + {{var}} blocks; build-request ":8080" test |
| AC-010 | path-params-panel.test.tsx "should preserve a grid-defined value when its :name is later added to the URL" (define-ahead-of-use); disk-format round-trip |
| AC-011 | query-sync-panel.test.tsx "should add an enabled Query row when ?key=value is typed into the URL" + "should persist a url-typed query param into config.params on save"; query-sync.test.ts syncParamsFromUrl block |
| AC-012 | query-sync-panel.test.tsx "should rewrite the URL query when a Query row value is edited"; query-sync.test.ts syncUrlFromParams block ({{var}} raw, order) |
| AC-013 | query-sync-panel.test.tsx "should remove a param from the URL when its Query row is disabled"; query-sync.test.ts "should exclude a disabled row" + "should strip the query string when no rows are enabled" |
| AC-014 | query-sync-panel.test.tsx "should disable a query row (keep its value) when its key is removed from the URL"; query-sync.test.ts disable/re-enable/drop-empty-cruft cases |
| AC-015 | build-request-query-dedup.test.ts (dedupe by key, url value wins, folder-only still appends) |
| AC-016 | build-request-query-dedup.test.ts "should still append a config.params key that is not in the url"; query-sync.test.ts "should leave a non-url row untouched and append a newly typed key" |

## Decision Log

| Date | Decision | Rationale |
| ---- | -------- | --------- |
| 2026-06-29 | Domain gate: neither pz-ddd nor pz-archetypes apply | Frontend tab split + URL string parsing, no domain model / aggregate / archetype shape |
| 2026-06-29 | Path params are request-only (`RequestNode.pathParams`), NOT in `ConfigScope` | A path slot is intrinsic to one URL; inheriting `:id` across siblings with different paths is meaningless. Keeps `EffectiveConfig`/resolve untouched |
| 2026-06-29 | Path tab is an editable key->value grid (keys editable), not URL-locked read-only keys | User: a path param can be DEFINED in the grid too, then used in the URL (Bruno model). Rows = union(URL `:name`, stored `pathParams` keys); default view is the grid (no empty-state hint) |
| 2026-06-29 | URL<->grid sync is delta-based, one-way URL->grid | Typing `:name` in URL adds a grid row; removing `:name` prunes ONLY that key; grid-only rows untouched by URL edits; a grid edit never rewrites the URL. Preserves a define-ahead value when its `:name` is later typed |
| 2026-06-29 | `:name` syntax, regex `/:([A-Za-z_]\w*)/g` | First-char letter/underscore rule excludes `https://` scheme + `:8080` port; distinct from `{{var}}` so no clash |
| 2026-06-29 | Empty value -> leave `:name` literal in sent URL | Postman behaviour; unfilled param stays visible in console rather than collapsing the path |
| 2026-06-29 | Query = existing `config.params`, no migration | Only the tab label/nesting moves; zero behaviour change keeps the diff minimal |
| 2026-06-30 | Query grid <-> URL `?query` bidirectional sync; store stays `config.params` (no new field) | User: a query param can live in the URL bar OR the grid, Bruno-style. Keeping config.params as the store preserves the toggle/inheritance/import paths; URL `?` is a live mirror of enabled rows. ADR logged (URL-bar behavior change) |
| 2026-06-30 | Remove-from-URL DISABLES the query row (value kept), unlike the Path tab's drop-on-remove | User's re-enable mental model: unchecking hides from URL, re-typing the key re-enables. An empty-value partial key (char-by-char typing cruft) is dropped, not disabled |
| 2026-06-30 | Send-time `appendParams` dedupes by key (URL value wins over config.params) | A mirrored enabled param lives in BOTH the URL and config.params; dedup avoids `?k=v&k=v`. Mirrors the existing OpenCollection importer convention (urlQueryKeys/toQueryParams) |

## Risks

- Regex over-capture (scheme/port): mitigated by `[A-Za-z_]` first-char rule + explicit TC-011.
- `:name` inside a query value misread as a path param (E-5): accepted, matches Postman; documented.
- URL-edit prune racing with a focused value edit: prune only drops keys absent from the URL, so a
  value being typed for a still-present `:name` is safe.
