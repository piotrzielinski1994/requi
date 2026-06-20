# Plan: Send request, read response, filter response

**Spec:** [spec.md](spec.md)
**Status:** COMPLETE - all 11 ACs verified by a fresh verifier subagent (verdict: SHIP). All
gates green: 372 frontend tests, 5 cargo tests, typecheck clean, lint 0 errors. Plus the
plan-§5 mid-flight-close guard (verifier flagged as missing) is now implemented + tested.

## AC traceability (final)

| AC | Proving test |
| -- | ------------ |
| AC-001 | send-url-bar: `should update the active request url as the user types`; send-request-context: `should revert the url if a tree request is edited, closed, then reopened` |
| AC-002 | send-request-context: `should reflect a method override on the active request` |
| AC-003 | send-request-context: `should call the http client exactly once per send`; `should send the overridden method and url for the active request` |
| AC-004 | build-request: var-subst in url/header/param + `should preserve an existing ?query…`; `should build the final url from a real resolved tree (var + params)` |
| AC-005 | send-response-pane: `should show a sending indicator…`; send-url-bar: `should disable the Send button while the request is in flight`; send-request-context: `should not call the client a second time if send fires again while sending` |
| AC-006 | send-response-pane: `should show the status, time, size and body on a successful send`; `should show the live response headers after a successful send` |
| AC-007 | send-response-pane: `should show the error message if the send fails`; send-request-context: `should allow re-sending after an error` |
| AC-008 | send-request-registry: `should register send-request with the Mod+Enter default` (+name/desc/resolve/conflict); send-shortcut: `should send the active request if Mod+Enter fires`; `should not call the client if Mod+Enter fires with no active request` |
| AC-009 | send-response-pane: `should narrow the shown body…`; `should show a matched scalar raw…`; filter unit suite |
| AC-010 | send-response-pane: `should restore the full body when the filter is cleared`; filter: empty/`$`/whitespace -> full body |
| AC-011 | send-response-pane: `should show a no-match indication…`; filter no-match suite (missing key/OOB/non-array/non-JSON/empty) |

Edge cases: GET/DELETE body-drop + POST/PUT/PATCH carry (build-request body-per-method);
mid-flight close drop (send-request-context: `should not resurrect response state for a
request closed before its send resolves`); Rust serde round-trip (cargo: 3 payload tests).

## 0. Shape of the work

One coherent loop, built pure-first so jsdom/network never gate the logic:

1. **Pure layer** (`src/lib/http/`): build the wire `HttpRequest` from a request node +
   its `EffectiveConfig` (`buildHttpRequest`), and the JSONPath evaluator (`filterJson`).
   Plain functions, fully unit-tested, no Tauri/jsdom.
2. **Port + adapters** (`HttpClient`): Tauri adapter calls the Rust command; in-memory/fake
   adapter for tests + browser `npm run dev`. Mirrors `fs` / `folder-picker`.
3. **Rust command** (`send_http_request`): `reqwest` send, measured, `Result<_,String>`.
4. **Session state**: generalize `bodyOverrides` -> `requestOverrides`; add `responseStates`
   + `setRequestUrl` / `setRequestMethod` / `sendRequest`.
5. **UI glue**: editable URL bar + method select + Send wired to `sendRequest`; response pane
   reads `responseState` (loading/error/success) over the seeded mock; filter input wired to
   `filterJson`.
6. **Shortcut**: add `send-request` to the registry + `Main` handler map.

TDD per AC: RED (fresh test-writer subagent) -> GREEN -> REFACTOR -> VERIFY (fresh verifier).

## 1. Approach & key decisions

- **Rust `reqwest` command over `@tauri-apps/plugin-http`.** We own the command, keep the
  request-building logic in TS (tested), and the Rust side stays a thin transport. rustls TLS
  feature so no system OpenSSL dependency on the build machines.
- **Port/adapter for `HttpClient`** (not a bare `invoke` in the component). Same seam as `fs`
  and `folder-picker`: threaded loader -> layout -> main, fake injected in tests. The Tauri
  adapter is the only file importing `@tauri-apps/api`; the rest is testable.
- **Generalize `bodyOverrides` -> `requestOverrides: Map<id, Partial<{url,method,body}>>`.**
  Avoids three parallel maps. `setRequestBody` becomes a thin wrapper that writes `{body}`;
  `requestsById` merges `{ ...base, ...override }`. Body-override tests stay green
  (behavior unchanged), so this is a safe refactor proven by the existing suite.
- **`buildHttpRequest(node, effective)` is pure.** Does `{{var}}` substitution (URL +
  header/param values), merges resolved params into the URL query string, maps `Auth` ->
  header (bearer -> `Authorization: Bearer`, basic -> `Authorization: Basic <b64>`), and
  drops the body for methods that don't carry one. Output is the exact wire shape the Rust
  command receives - so the network adapter is dumb.
- **`filterJson(body, path)` is pure** and total: returns `{ ok: true, text }` or
  `{ ok: false }` (ADT, no throw). Empty path -> full body. Supports `$`, `.key`, `[index]`.
- **Response precedence:** `responseState` for the active id wins; `idle` falls back to the
  node's seeded `response` (keeps existing mock UX) else "No response".

## 2. Files

### Create

| File | Purpose |
| ---- | ------- |
| `src/lib/http/model.ts` | `HttpRequest`, `SendResult`, `HttpClient`, `ResponseState` types |
| `src/lib/http/build-request.ts` | `buildHttpRequest(node, effective)` pure builder |
| `src/lib/http/filter.ts` | `filterJson(body, path)` JSONPath subset evaluator (ADT result) |
| `src/lib/http/tauri-client.ts` | `createTauriHttpClient()` -> `invoke("send_http_request", …)` |
| `src/lib/http/fake-client.ts` | `createFakeHttpClient(scripted)` for tests/browser |
| `src/lib/http/__tests__/build-request.test.ts` | builder units (vars/params/auth/body-drop) |
| `src/lib/http/__tests__/filter.test.ts` | JSONPath units (extract/empty/no-match/non-JSON) |

### Modify

| File | Change |
| ---- | ------ |
| `src-tauri/Cargo.toml` | add `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls"] }` |
| `src-tauri/src/lib.rs` | `send_http_request` async command + register in `invoke_handler`; unit tests for the request struct round-trip |
| `src/lib/shortcuts/registry.ts` | add `send-request` action (`Mod+Enter`) to the id union + `SHORTCUT_ACTIONS` |
| `src/components/workspace/workspace-context.tsx` | `requestOverrides` map, `responseStates` map, `setRequestUrl`, `setRequestMethod`, `sendRequest(id)`, take `httpClient` prop |
| `src/components/workspace/url-bar.tsx` | editable URL `Input`, live method `Select onValueChange`, Send `onClick=sendRequest` + disabled while sending |
| `src/components/workspace/response-pane.tsx` | render `responseState` (loading/error/success) over seeded mock; wire filter input to `filterJson` |
| `src/components/workspace/workspace-loader.tsx` | accept + thread `httpClient` into `WorkspaceProvider` |
| `src/components/workspace/workspace-layout.tsx`, `main.tsx` | thread `httpClient` prop (mirrors `picker`) |
| `src/routes/index.tsx` | `useState(createTauriHttpClient)`, pass to loader |
| `src/components/workspace/main.tsx` | add `"send-request": () => sendRequest(activeRequestId)` to handler map |
| `README.md` | document Send/response/filter + the new shortcut + reqwest dependency note |
| `docs/learnings.md`, `docs/adr.md` | gotchas + decisions |

## 3. Execution order (RED->GREEN per AC)

1. **Pure builder** (`buildHttpRequest`) - AC-003/004. RED units, GREEN.
2. **Pure filter** (`filterJson`) - AC-009/010/011. RED units, GREEN.
3. **Rust command** - `cargo test` the struct round-trip; manual `reqwest` send verified
   against `postman-echo.com/get`.
4. **Context** (`requestOverrides` refactor + `setRequestUrl/Method` + `sendRequest` +
   `responseStates`) - AC-001/002/003/005/007. RED context tests with a fake client, GREEN.
5. **Registry + Main handler** - AC-008. RED registry/handler test, GREEN.
6. **URL bar** editable + Send - AC-001/002/005. RED component tests, GREEN.
7. **Response pane** states + filter - AC-006/007/009/010/011. RED component tests, GREEN.
8. REFACTOR; VERIFY (fresh subagent); README/docs.

## 4. Tests to write (min one per AC + edge cases)

- build-request: var substitution in URL + header/param values; param merge into existing
  `?query`; bearer/basic/none -> header; body dropped for GET/DELETE, kept for POST/PUT/PATCH;
  timeout carried through.
- filter: `$.a.b`, `$.arr[0]`, nested; `$` / empty -> whole body; missing key + OOB index ->
  no match; non-JSON / empty body -> no match; scalar vs object/array formatting.
- context: `setRequestUrl`/`setRequestMethod` reflect on `activeRequest` and are per-id +
  cleared on close; `sendRequest` calls the client once, transitions sending->success and
  sending->error; double-send blocked while sending; draft sends.
- registry: `send-request` present with default `Mod+Enter`; Main maps it to `sendRequest`.
- url-bar: typing updates url; selecting method updates method; Send disabled while sending.
- response-pane: loading text; error message; success status/body/headers; filter narrows
  body; empty filter restores; no-match indication.

## 5. Risks

- reqwest build time / TLS backend: use `rustls-tls` + `default-features=false` to dodge
  system OpenSSL; first `cargo build` is slower (accepted).
- Concurrency: a request closed mid-flight - `sendRequest` resolves against a possibly-gone
  id; guard by writing the result only if the id is still tracked (drop otherwise).
- `requestOverrides` refactor could regress body edits: the existing body-override suite is
  the safety net - keep it green throughout.
- jsdom can't exercise real HTTP: all component/context tests use the fake client; the Rust
  send is covered by `cargo test` + one manual postman-echo run.

## 6. Acceptance verification

Fresh verifier subagent maps each AC-001..011 to a proving test, runs lint + typecheck +
full Vitest suite + `cargo test`, and adversarially probes the edge-case list. AC -> test
table written back here once green.
