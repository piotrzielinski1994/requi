# Path & Query params as separate sub-tabs

## Overview

The single **Params** request tab is split into two sub-views behind a sub-bar:
**Path** and **Query**. The Params tab stays in the main pane tab bar; directly under
it sits a second (sub) bar with two triggers - `Path` and `Query` - and the active
sub-view's table below.

- **Query** is the existing behaviour, unchanged: edits `config.params` (a `KeyValue[]`,
  inherited down the folder chain, per-row enable toggle, merged into the URL query
  string at send time). Only the tab label moves from "Params" to "Query".
- **Path** is new. The Path sub-view is an **editable key->value grid** (editable keys
  AND values, trailing blank row, delete - like Query but with no enable toggle). A path
  param can be defined **either** directly in this grid **or** by writing `:name` inline
  in the URL path (e.g. `https://api.example.com/users/:id`). The two stay in sync
  (Bruno-style, see AC-005): the grid is the editable store; the URL drives add/remove of
  the params it mentions, while grid-only rows are never touched by URL edits. Path params
  are **request-only** - they live on the request (`pathParams`), are not inherited from
  folders, and resolve only against that request's own URL.

At send time each `:name` in the URL path is replaced by its value (after `{{var}}`
interpolation). A path param with an **empty value** is left literal (`:id` stays in the
sent URL, visible in the console). The **same `:name` repeated** in one URL is a single
row whose value fills every occurrence.

## Acceptance Criteria

- AC-001: The **Params** tab renders a sub-bar with two triggers, **Path** and **Query**,
  and shows the selected sub-view's table below. Default selected sub-view is **Query**
  (preserves today's single-tab behaviour).
- AC-002: The **Query** sub-view edits `config.params` (request scope) with the per-row
  enable toggle, trailing blank row, and `{{var}}` value highlighting, as today - and it
  now bidirectionally mirrors the URL's `?query` string (see AC-011..AC-016). Enabled query
  params still merge into the URL query string at send time, deduped by key so a param that
  is in both the URL and `config.params` is sent once.
- AC-003: The **Path** sub-view is an editable key->value grid backed by
  `request.pathParams` (editable keys AND values, a trailing blank row to add, a per-row
  delete, `{{var}}` value highlighting; no enable toggle). It renders as the default empty
  view (a single blank row) even when the URL has no `:name` - it is NOT gated on the URL.
- AC-004: Editing a row's key/value in the grid stores it on the request as
  `pathParams[key] = value` (an in-memory draft override; persisted on Cmd+S like other
  request edits). A blank-key row is dropped on commit (like the other grids).
- AC-005: The grid and the URL stay in sync (Bruno-style): typing a new `:name` into the
  URL **adds** a (blank-value) row for it to the grid; removing a `:name` from the URL
  **removes** that row (and prunes its stored value, so no orphan persists). A row added
  **in the grid** never modifies the URL and is never removed by an unrelated URL edit -
  only URL-mentioned params are URL-driven.
- AC-006: At send time, each `:name` in the URL path is replaced by its `pathParams[name]`
  value with `{{var}}`/`{{process.env.X}}` interpolation applied to that value. A repeated
  `:name` is replaced at every occurrence by the one row's value.
- AC-007: A path param whose value is empty (or has no entry) is **left literal**: the
  `:name` token stays verbatim in the sent URL.
- AC-008: `pathParams` persists on the request file only when non-empty and round-trips
  through serialize/deserialize; a malformed/non-string entry on disk is sanitized away
  without crashing.
- AC-009: The colon detector never captures the scheme separator (`https://`) or a port
  (`:8080`) - only `:` followed by a letter/underscore then word chars is a param.
- AC-010: A grid-defined path param whose `:name` is NOT (yet) in the URL is kept in
  `pathParams` and persists; it simply has no occurrence to substitute until its `:name`
  is added to the URL (define-ahead-of-use).

### Query <-> URL bidirectional sync (request scope only)

The request's **own** query params are mirrored between the URL bar's `?query` string and the
Query grid (which is `config.params` at request scope). Folder-inherited params are NOT in the
URL and are unaffected. `config.params` stays the single store; the URL `?` is a live mirror of
the request's **enabled** rows. The path, `:pathParams`, and `#hash` are never touched by sync.

- AC-011: Typing a `?key=value` into the URL bar **adds** an enabled row `{key, value}` to the
  request's `config.params` (Query grid). Editing the value of a key already in the URL updates
  that row's value. The grid reflects it without a manual refresh.
- AC-012: Enabling/adding/editing a Query grid row **writes it into the URL** `?query` string
  (key, value, `{{var}}` tokens kept verbatim); the grid order is preserved in the query string.
- AC-013: **Disabling** (unchecking) or **deleting** a Query grid row **removes** that key from
  the URL `?query` string; a disabled row keeps its value in `config.params` (not sent, not in
  the URL) so it can be re-enabled later.
- AC-014: **Removing** an enabled key from the URL `?query` string **disables** its grid row
  (value kept) rather than deleting it; re-typing the same key into the URL **re-enables** the
  row (AC-011 path), preserving the stored value if the typed value matches or updating it.
- AC-015: At send time the URL query and `config.params` are merged **deduped by key**: a key
  present in the URL is not appended again from `config.params` (the URL value wins), so a
  mirrored param is sent exactly once. Folder-only params (not in the URL) still append.
- AC-016: Sync only touches **request-scope** `config.params`. A folder-inherited query param
  is never written into the request URL and never disabled by a URL edit; it continues to append
  at send (subject to the AC-015 dedup).

## Test Cases

- TC-001 (happy, AC-001): open a request -> Params tab shows a Path/Query sub-bar; Query is
  selected; clicking Path switches the table; clicking Query switches back. Maps to: AC-001.
- TC-002 (query unchanged, AC-002): in the Query sub-view, add a row `foo=bar`, toggle it
  off -> `config.params` updates with `enabled:false`; it is excluded from the sent URL but
  kept on disk. Maps to: AC-002.
- TC-002b (grid define, AC-003/004): on the Path sub-view, type key `id` value `42` into the
  blank row -> request override carries `pathParams.id === "42"`; the URL is NOT modified.
  Maps to: AC-003, AC-004, AC-005.
- TC-003 (URL adds row, AC-005): URL `https://api.com/users/:id/posts/:postId` -> Path grid
  shows rows `id` and `postId` (blank values, in that order). Maps to: AC-005, AC-009.
- TC-004 (edit value, AC-004): set `id` value to `42` -> request override carries
  `pathParams.id === "42"`. Maps to: AC-004.
- TC-005 (URL removes row + prune, AC-005): with `pathParams = {id:"42"}` and URL
  `.../users/:id`, edit URL to drop `:id` -> the `id` row disappears and `pathParams.id` is
  pruned (no orphan on save). A separate grid-only row (`limit=5`, no `:limit` in URL) stays.
  Maps to: AC-005, AC-010, E-6.
- TC-006 (send substitution, AC-006): URL `.../users/:id` + `pathParams.id = "42"` ->
  sent URL `.../users/42`. With `id = "{{uid}}"` and `uid=7` -> `.../users/7`. Maps to: AC-006.
- TC-007 (repeat, AC-006): URL `/:id/x/:id` + `id = "9"` -> `/9/x/9`. Maps to: AC-006.
- TC-008 (empty -> literal, AC-007): URL `.../users/:id` with no/empty `id` value -> sent
  URL keeps `.../users/:id`. Maps to: AC-007.
- TC-009 (default grid, AC-003): URL `https://api.com/health` (no `:name`) -> Path sub-view
  shows the editable grid with a trailing blank row (NOT an empty-state hint). Maps to: AC-003.
- TC-010 (persist, AC-008): `deserialize(serialize(tree))` round-trips a request's
  `pathParams`; the field is absent on disk when empty; a non-string value on disk is
  dropped on load. Maps to: AC-008.
- TC-011 (scheme/port guard, AC-009): URL `https://host:8080/p/:id` -> Path grid gets only
  `id` (not `https` or `8080`). Maps to: AC-009.
- TC-012 (no clash with {{var}}, AC-009): URL `.../{{base}}/:id` -> only `id` is added to the
  grid from the URL; `{{base}}` stays a variable token. Maps to: AC-009.
- TC-013 (define-ahead, AC-010): grid row `id=42`, URL has no `:id` -> `pathParams.id`
  persists; then type `:id` into URL -> the existing `42` value is preserved (not blanked).
  Maps to: AC-005, AC-010.

## UI States

| State   | Behavior                                                                 |
| ------- | ------------------------------------------------------------------------ |
| Empty   | Path: editable grid with a single trailing blank row (no hint). Query: trailing blank row only (as today). |
| Default | Query sub-view selected; its key/value table renders as today.           |
| Active  | Selected sub-bar trigger styled like the main pane tabs (active underline). |
| Path    | Editable key->value grid (keys + values editable, trailing blank, delete, `{{var}}` value highlight; no enable toggle). Rows mirror `pathParams`, unioned with URL `:name` tokens. |

### Wireframe - Params tab, Query sub-view (default)

```
+----------------------------------------------------------------+
| Vars | Auth | Headers | Params | Body | Script | Settings      |  <- main pane tab bar
+----------------------------------------------------------------+
| Path | Query |                                                  |  <- sub-bar (Query active)
+----------------------------------------------------------------+
| [x] | key            | value              |          [trash]   |
| [x] | foo            | bar                |          [trash]   |
| [ ] | page           | 2                  |          [trash]   |
|     | key            | value              |                    |  <- trailing blank
+----------------------------------------------------------------+
```

### Wireframe - Params tab, Path sub-view (editable grid)

URL bar: `https://api.example.com/users/:id/posts/:postId`

```
+----------------------------------------------------------------+
| Vars | Auth | Headers | Params | Body | Script | Settings      |
+----------------------------------------------------------------+
| Path | Query |                                                  |  <- sub-bar (Path active)
+----------------------------------------------------------------+
| id              | 42                 |               [trash]   |  <- :id from URL, value editable
| postId          | 7                  |               [trash]   |  <- :postId from URL
| limit           | 5                  |               [trash]   |  <- grid-only (no :limit in URL yet)
|                 | value              |               [trash]   |  <- trailing blank (add a new param)
+----------------------------------------------------------------+
```

### Wireframe - Params tab, Path sub-view (no `:name` in URL)

URL bar: `https://api.example.com/health`

```
+----------------------------------------------------------------+
| Vars | Auth | Headers | Params | Body | Script | Settings      |
+----------------------------------------------------------------+
| Path | Query |                                                  |
+----------------------------------------------------------------+
| key             | value              |               [trash]   |  <- editable grid, single blank row
+----------------------------------------------------------------+
```

## Data Model

- `RequestNode.pathParams?: Record<string, string>` - new, request-only. Maps a path-param
  name (the `:name` token without the colon) to its value (may contain `{{var}}` tokens).
  Absent/empty when the request uses no path params.
- `config.params` (existing `KeyValue[]`) is unchanged and now surfaced under the **Query**
  sub-tab.
- No change to `ConfigScope`, `EffectiveConfig`, or folder inheritance - path params are
  deliberately outside the inherited config.

## Edge Cases

- E-1: `:name` immediately after the scheme (`https://`) or as a port (`:8080`) must NOT be
  detected - regex requires `:` + `[A-Za-z_]`.
- E-2: Same `:name` twice -> one row, value applied to all occurrences.
- E-3: Empty value -> leave the literal `:name` in the sent URL (do not collapse to empty).
- E-4: Path-param value contains `{{var}}` -> interpolated before substitution into the URL.
- E-5: A `:name` inside the query string (after `?`) - detection runs on the whole URL; a
  `:name` there is still a path-param row. (Acceptable; colon in a query value is rare and
  Postman behaves the same.)
- E-6: Removing a `:name` from the URL prunes its stored value so no orphan persists - BUT
  only for params the URL mentioned; a grid-only row (its `:name` never in the URL) is never
  pruned by a URL edit.
- E-7: Malformed `pathParams` on disk (non-object, or non-string values) -> sanitized on
  load, request otherwise intact.
- E-8: A grid row defined ahead of the URL (`id=42`, no `:id` yet) keeps its value when the
  URL later gains `:id` (URL add must not blank an existing value).

## Dependencies

- Existing `EditableKeyValueTable` (Query sub-view reused as-is; Path sub-view reuses it as a
  `Record`-backed grid, the same way `VarsPanel` does - no enable toggle).
- Existing `HighlightedInput` + `TokenHighlightContext` (Path value cells, `{{var}}` highlight).
- Existing `buildHttpRequest` / `appendParams` in `build-request.ts` (path substitution added
  before query append).
- Existing request-override persistence in `workspace-context.tsx`.

## Out of Scope (YAGNI)

- Path params inherited from folders or environments.
- A grid edit writing `:name` back into the URL (the URL -> grid direction is one-way add/remove;
  grid -> URL is never automatic).
- `{name}` (brace) path syntax - colon only.
- Reordering / enable-toggle on path params.
