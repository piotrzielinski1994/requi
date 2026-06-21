# Plan: Send / Response Robustness

From the approved [spec.md](spec.md). TDD order. Touches the send loop end to end:
Rust `lib.rs` (cancel token + integration test), the `HttpClient` port + both adapters, the
workspace send loop, the URL bar (Stop), and the response pane (formatting + big-body guard).

## Approach

Three independent axes that share the send path; sequence them so each lands behind its own
tests:

1. **Cancel (real Rust token).** A `requestId` rides the wire request. Rust keeps a global
   `Mutex<HashMap<String, CancellationToken>>`; `send_http_request` inserts a token under the id,
   races `builder.send()` + `response.text()` against `token.cancelled()` with `tokio::select!`,
   and removes the token on every exit (RAII guard struct so no path leaks). A new
   `cancel_http_request(requestId)` command fires the token; missing id = no-op (idempotent). The
   frontend `HttpClient` gains `cancel`; the send loop captures a per-request **generation** so a
   stale resolve can't clobber a newer send, and a cancelled result resolves to **idle** not error.
2. **Readable size/time + big-body guard (frontend).** Pure `format.ts` (`formatBytes`,
   `formatDuration`) used by the response status row. The response body viewer gets a render guard:
   over `RESPONSE_RENDER_LIMIT_BYTES` (~2 MB) it shows a head-truncated preview + notice and hides
   the filter, instead of feeding the whole string to the JSON viewer. Rust still returns the full
   body + truthful `sizeBytes`.
3. **Rust integration test (mock server).** `wiremock` dev-dep (primary; cargo-fetch confirmed
   reachable), `httpmock` cached fallback. Tests cover success / 500 / unreachable / cancel.

`tokio` (`sync` + `macros` + `rt-multi-thread`) and `tokio-util` (`rt` for `CancellationToken`)
move from transitive to direct `[dependencies]`.

## File changes

**Rust (`src-tauri/`):**
- `Cargo.toml` - add `tokio` + `tokio-util` to `[dependencies]`; add the mock crate to
  `[dev-dependencies]` (`wiremock`, else cached `httpmock`).
- `src/lib.rs`:
  - `HttpRequestPayload` gains `request_id: String` (camelCase `requestId`).
  - Global registry: `static CANCELS: LazyLock<Mutex<HashMap<String, CancellationToken>>>` (or a
    `tauri::State` registered in `run()`); helper to insert/remove.
  - `send_http_request` - create token, register under `request_id`, `tokio::select!` the
    send+body-read against `token.cancelled()`, return `CANCEL_SENTINEL` on cancel; a guard struct
    (`Drop`) removes the id on every exit.
  - new `cancel_http_request(request_id: String)` command -> look up + `.cancel()`, no-op if
    absent. Register it in `generate_handler!`.
  - `CANCEL_SENTINEL` const.

**Frontend port + adapters:**
- `src/lib/http/model.ts` - `HttpRequest` gains `requestId`; `HttpClient` gains
  `cancel(requestId)`; `SendResult` error variant gains optional `cancelled`.
- `src/lib/http/tauri-client.ts` - `cancel` invokes `cancel_http_request`; `send` maps the
  `CANCEL_SENTINEL` error string to `{ ok: false, error, cancelled: true }`.
- `src/lib/http/fake-client.ts` - `cancel` is a no-op (`Promise.resolve()`).
- `src/lib/http/build-request.ts` - set `requestId` on the returned request
  (`crypto.randomUUID()`).

**Formatting + guard (pure + UI):**
- `src/lib/http/format.ts` (new) - `formatBytes(bytes)` (B/KB/MB) + `formatDuration(ms)` (ms/s),
  and the `RESPONSE_RENDER_LIMIT_BYTES` constant.
- `src/components/workspace/response-pane.tsx` - status row uses the formatters; `ResponseBody`
  branches on body length: over the limit -> truncated preview + notice, filter hidden; at/under
  -> current behavior.

**Send loop / Stop control:**
- `src/components/workspace/workspace-context.tsx` - `sendRequest` generates a fresh `requestId`
  per invocation, bumps a per-id generation ref, and on resolve ignores a result whose generation
  is stale; a `cancelled` result leaves state at idle; new `cancelRequest(id)` action calls
  `httpClientRef.current.cancel(requestId)` for the in-flight send (guarded by `status === sending`).
- `src/components/workspace/url-bar.tsx` - while sending, render **Stop** (wired to
  `cancelRequest`) instead of Send; the send shortcut path cancels while sending.

## Edge cases handled (from spec §7)

- Cancel after completion / double cancel / no send -> idempotent no-op (Rust missing-id + frontend
  status guard).
- Stale result race after cancel+re-send -> generation ref guard (AC-002 / TC-003).
- Body exactly at threshold -> rendered fully (inclusive; TC-005).
- Body-read cancel (slow download) -> both awaits inside the `select!`.
- Near-instant mock `time_ms == 0` -> test asserts `>= 0`, strict on `size_bytes == body.len()`.
- Token map leak -> Drop-guard removal on every exit path.

## Tests to write (RED first, one+ per AC)

Pure (Vitest, no React):
- `format.test.ts` - `formatBytes` B/KB/MB + 1024 boundary, `formatDuration` ms/s (TC-001/AC-004).
- `build-request*.test.ts` (extend) - output carries a `requestId` (TC-008/AC-007).

React (Vitest + RTL):
- url-bar / send-loop: sending shows **Stop**, click cancels -> idle + no error + `cancel` called
  (TC-002/AC-001); stale resolve after cancel+re-send doesn't clobber (TC-003/AC-002).
- response-pane: huge body -> notice + preview, viewer not given full string, filter absent
  (TC-004/AC-005); just-under + at-threshold render fully (TC-005); status row formatted (AC-004).
- fake-client `cancel` resolves without throwing (TC-008/AC-007).

Rust (`cargo test`, `#[tokio::test]` + mock server):
- success: 200 + JSON + header -> parsed payload, `size_bytes == body.len()`, `time_ms >= 0`
  (TC-007/AC-006).
- 500 -> `Ok` with status 500 (HTTP error != transport error) (TC-007).
- unreachable URL -> `Err` (TC-007).
- cancel: mock hangs, `cancel_http_request(id)` -> send resolves to `CANCEL_SENTINEL`, registry no
  longer holds id (TC-006/AC-003).

## Execution order

1. RED: spawn test-writer subagent (skill Phase 3) for the ACs/TCs above (frontend + Rust).
2. GREEN per axis:
   a. Rust cancel: `Cargo.toml` deps -> `request_id` + registry + `select!` + `cancel_http_request`
      -> mock integration tests. Commit `feat(send-robustness): AC-003/AC-006 Rust cancel + integration test`.
   b. Port/adapters + send loop + Stop: model/clients/build-request -> context generation + cancel
      -> url-bar Stop. Commit `feat(send-robustness): AC-001/AC-002/AC-007 cancel wiring + Stop`.
   c. format + guard: `format.ts` -> response-pane. Commit `feat(send-robustness): AC-004/AC-005 readable metrics + big-body guard`.
3. REFACTOR: collapse any send-loop ifology; tighten types; keep green.
4. VERIFY: fresh verifier subagent; run `npm test`, `npm run typecheck`, `npm run lint`,
   `cd src-tauri && cargo test`.

## Acceptance verification

- AC-001..007 each map to a named test (trace table filled into this file after verify). Gates:
  vitest all-green, tsc clean, eslint clean, `cargo test` green incl. the new integration tests.

## AC traceability (verified PASS, 762 frontend tests + 9 Rust)

| AC | Test |
| ---- | ---- |
| AC-001 | send-cancel "should show a Stop control instead of Send while a request is in flight" / "should return the response state to idle with no error shown after Stop"; send-url-bar "should swap Send for Stop while the request is in flight" |
| AC-002 | send-cancel "should call cancel with the in-flight requestId when Stop is clicked" + "should ignore a gen-1 result that resolves after a cancel and re-send" (mutation-verified: fails if the generation guard is removed) |
| AC-003 | lib.rs `should_abort_the_send_to_the_cancel_sentinel_if_cancelled` (Err == sentinel + registry no longer holds id; Drop-guard removes on every exit) |
| AC-004 | format.test "formatBytes"/"formatDuration"; response-pane-guard "formatted status row" block (rendered "512 B"/"142ms"/"2.0 KB"/"1.52s") |
| AC-005 | response-pane-guard too-large notice / filter-hidden / "should not hand the full string to the viewer" (asserts no `.cm-editor`, preview bounded) / just-under + exactly-at-threshold render fully |
| AC-006 | lib.rs `should_parse_a_successful_response_if_the_server_returns_200` (status/body/header/`size_bytes==body.len()`) + `should_return_ok_with_status_500_if_the_server_errors` + `should_return_err_if_the_host_is_unreachable` |
| AC-007 | build-request "should attach a non-empty requestId" + "should generate a distinct requestId for each build invocation"; fake-client "should resolve without throwing if cancel is called" |

Status: **Implemented + verified** (fresh-context verifier PASS, all 7 ACs + 4 gates green;
two flagged weak tests tightened, em-dashes stripped from new files/comments). typecheck clean,
lint 0 errors, vitest 762/762, cargo 9/9.

Deviations from plan: none material. `cancel_http_request` is `async fn` (the cancel test awaits
it). Body-read cancel (the second `tokio::select!`) is code-present but only the initial-send
race is directly tested - the hang mock delays the whole 200, so the body-read await is never
reached in test (acceptable; covered by inspection).

## Risks

- **Mock crate fetch needs network.** `wiremock` confirmed reachable via `cargo add --dry-run`;
  `httpmock-0.7.0` is already cached as the offline fallback. Mitigation: if `wiremock` fetch
  fails, switch the dev-dep to `httpmock` (different API - the test is the only caller).
- **`tokio::select!` + reqwest cancel cleanly aborts the connection.** Dropping the `send()` future
  is reqwest's documented cancel path; the integration cancel test (TC-006) is the proof. If the
  body-read await can't be cancelled mid-stream on a given platform, the initial-send select still
  covers the common case.
- **Promoting tokio to a direct dep** must match the version tauri already resolves (read
  `Cargo.lock`) to avoid a duplicate tokio. Mitigation: pin to the major already in the lock (`1`).
- **Generation guard correctness** - the stale-resolve race is subtle; TC-003 pins it. Use a
  `Map<id, number>` ref bumped per send, captured in the closure, compared on resolve.
- **`crypto.randomUUID` in the test/browser env** - jsdom + Tauri webview both expose it; the fake
  client path doesn't need a real id. If jsdom lacks it under the test runner, the build-request
  test will surface it in RED.
