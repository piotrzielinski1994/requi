# Plan: Import / Export (cURL)

From the approved [spec.md](spec.md). TDD order. Two text bridges, entirely frontend - **no Rust
change**. Two pure modules (`to-curl.ts`, `parse-curl.ts`) do the work; the UI/context layer
just wires actions + a paste dialog.

## Approach

Both halves pivot on a pure, React-free core so the hard logic (shell quoting, flag mapping,
argument escaping) is unit-tested directly:

- **Copy** = `toCurl(req: HttpRequest): string`. It consumes the **already-resolved** wire
  request from `buildHttpRequest`, so all substitution/auth/param/body-encoding logic is reused,
  not reimplemented. `toCurl` only formats + quotes. Auth is already a header on the wire request
  -> not re-emitted from `req.auth`.
- **Import** = `parseCurl(text: string): CurlParseResult` (an ADT, not exceptions - per
  CLAUDE.md "ADT over try/catch"). Stage 1 tokenizes respecting shell quoting; stage 2 folds
  tokens into a `ParsedCurl` via a flag->handler map (strategy table, not an if-ladder). The
  context layer maps a successful `ParsedCurl` to a `RequestNode` and reuses the existing
  `newRequest` placement + `persistTree` path.

Single-quote-everything is the chosen quoting strategy for copy (simplest correct shell quoting):
wrap each arg in `'...'`, replace any `'` with `'\''`. For parse, a small hand-written tokenizer
(no dependency) handles `'`, `"`, `\`, and backslash-newline.

## File changes

**Pure core (no UI, no React):**
- `src/lib/curl/to-curl.ts` (new) - `toCurl(req: HttpRequest): string`. `-X`, single-quoted url,
  one `-H` per header, `--data-raw` when body non-empty. `shellQuote(s)` helper (the `'\''`
  idiom) lives here.
- `src/lib/curl/parse-curl.ts` (new) - `parseCurl(text): CurlParseResult`; internal
  `tokenize(text): string[]` + a flag-dispatch table. Exports `ParsedCurl`/`CurlParseResult`
  types.

**Shortcut registry:**
- `src/lib/shortcuts/registry.ts` - add ids `copy-as-curl` (default `Mod+Shift+C`) and
  `import-curl` (default `Mod+Shift+I`) to the union + `SHORTCUT_ACTIONS`.

**Context (actions + dialog state):**
- `src/components/workspace/workspace-context.tsx` -
  - `copyAsCurl()`: guard on `activeRequest`/`effectiveConfig`; build wire via
    `buildHttpRequest`, `navigator.clipboard?.writeText(toCurl(wire))`, toast "Copied as cURL".
  - `curlImport` dialog state: `isCurlImportOpen` + `openCurlImport()` / `closeCurlImport()`;
    `importCurl(text): CurlParseResult` that on `ok` maps `ParsedCurl`->`RequestNode` and runs the
    same insert/open/select/persist sequence as `newRequest` (factor a private
    `createRequestNode(partial, target?)` from the existing `newRequest` body so both share
    placement + persistence; `newRequest` becomes `createRequestNode({})`). On `!ok` returns the
    result so the dialog renders the error. Expose all on the context value + its type.

**UI:**
- `src/components/workspace/curl-import-dialog.tsx` (new) - `Dialog` + `textarea` + Import/Cancel,
  inline error, Import disabled while empty. Reads `isCurlImportOpen`/`importCurl`/`closeCurlImport`
  from context (mirrors `CloseConfirmDialog`/`DeleteConfirmDialog`).
- `src/components/workspace/main.tsx` - add `"copy-as-curl": copyAsCurl` and
  `"import-curl": openCurlImport` to `handlers`; render `<CurlImportDialog />` in the `palette`
  fragment.

## Edge cases handled (from spec §8)

- Copy with no active request -> guarded no-op.
- Body single quotes/newlines on copy -> `'\''` escaping, newlines survive in-quote.
- Empty/whitespace import -> `parseCurl` returns `{ ok: false }`, dialog stays open with error.
- Bare `curl` / no URL -> `{ ok: false }`.
- Unknown flags on import -> skipped (default branch in dispatch table), never fatal.
- Non-JSON `-d` body -> stored in json `body` slot, sent verbatim.
- `-F`/`--form` -> treated as unknown (no body), documented limitation.
- Method casing -> upper-normalized; unrecognized -> data-presence default.

## Tests to write (RED first, one+ per AC)

Pure (Vitest, no React):
- `to-curl.test.ts` - `-X`/url/headers/`--data-raw` shape (AC-001/002), no data flag on null/empty
  body (AC-002, TC-002), `'\''` escaping of a body with a quote (AC-003, TC-001).
- `parse-curl.test.ts` - method/url/headers (AC-005, TC-003), data flags + method default
  (AC-006, TC-004), tokenizer single/double-quote + line-continuation, one-line == multi-line
  (AC-007, TC-003/007), `-u`/`-b`/unknown-flag (AC-008, TC-005), `{ ok:false }` cases (AC-009,
  TC-006).
- registry: `copy-as-curl`/`import-curl` registered with their defaults (AC-011) - extend
  `new-actions-registry.test.ts` or a focused file.

React (Vitest + RTL):
- `curl-import-dialog` integration (AC-010, TC-008): open dialog, paste valid curl, Import ->
  new node in tree + opened tab + persisted (fake `onTreeChange`); Cancel -> nothing; invalid
  paste -> inline error, dialog stays, no node.
- palette/copy integration (AC-004/011, TC-009): palette lists both commands; Copy with an
  active request calls `clipboard.writeText` (mock) + toast; Copy with none does nothing.

## Execution order

1. RED: spawn test-writer subagent (skill Phase 3) for the ACs/TCs above.
2. GREEN per AC group: `to-curl` -> `parse-curl` -> registry -> context actions + dialog state ->
   `CurlImportDialog` + `main.tsx` wiring. One commit per AC group
   `feat(import-export): AC-NNN ...`.
3. REFACTOR: keep flag dispatch a clean table; tighten types; factor `createRequestNode` cleanly.
4. VERIFY: fresh verifier subagent; `npm test`, `npm run typecheck`, `npm run lint`,
   `cd src-tauri && cargo test` (must stay green - no Rust delta).

## Acceptance verification

- AC-001..011 each map to a named test (trace table filled into this file after verify). Gates:
  vitest all-green, tsc clean, eslint clean, cargo test green (no Rust change). Coverage
  threshold: none enforced.

## Risks

- **Shell quoting correctness:** the `'\''` idiom is the one subtle bit; covered by an explicit
  quote-in-body test (TC-001) and a round-trip-ish tokenizer test (TC-007). Mitigation: assert
  exact output strings, not substrings.
- **Tokenizer scope creep:** real shells do far more (var expansion, `$'...'`, command subst). We
  deliberately handle only `'`, `"`, `\`, line-continuation - enough for pasted browser/curl
  output. Documented in spec §8; do not gold-plate.
- **`createRequestNode` refactor touches `newRequest`:** extracting the shared body must not
  change New-request behavior (auto-name, focus URL nonce). Mitigation: existing tree-crud tests
  must stay green; refactor in the REFACTOR step with tests already green.

## AC traceability (verified PASS, 806 tests)

| AC | Test |
| ---- | ---- |
| AC-001 | to-curl "should emit -X METHOD, the single-quoted url, and one -H per resolved header in order" |
| AC-002 | to-curl "should emit --data-raw for a non-empty wire body" / "...no data flag if null (GET/DELETE)" / "...empty string" |
| AC-003 | to-curl "should escape an embedded single quote in the body via the '\\'' idiom" + header-escape + newline-survives |
| AC-004 | curl-import-export "should write a curl string to the clipboard and toast..." / "should do nothing ... with no active request" |
| AC-005 | parse-curl "should extract the -X method, positional url, and -H headers" + --request/--url/--header forms |
| AC-006 | parse-curl "should join multiple -d data flags with '&'" + alias/POST-default/GET-default/explicit-X-wins |
| AC-007 | parse-curl "should parse a backslash-newline multi-line curl identically to one line" + quote/`'\''`/leading-$ |
| AC-008 | parse-curl -u/--user basic, -b/--cookie Cookie header, "should ignore unknown flags ... without failing" |
| AC-009 | parse-curl empty / whitespace / bare-curl -> ok:false; url present -> ok:true |
| AC-010 | curl-import-export "should create a new request tab and persist..." / cancel makes nothing / invalid inline error |
| AC-011 | curl-actions-registry (defaults + resolveShortcuts) + resolve.test ACTION_IDS + palette-lists integration |

Status: **Implemented + verified** (fresh-context verifier PASS). typecheck clean, lint 0 errors
(7 pre-existing warnings), 806 frontend tests, cargo 9/9 (no Rust change). No deviation from plan;
spec §8 `-F` wording sharpened post-verify (the flag's argument is not specially consumed).
