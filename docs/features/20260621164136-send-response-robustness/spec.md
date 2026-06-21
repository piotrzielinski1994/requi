# Spec: Send / Response Robustness (cancel, readable size/time, big-body guard, Rust send test)

**Version:** 0.1.0
**Created:** 2026-06-21
**Status:** Draft

## 1. Overview

The send loop today is fire-and-forget: once `sendRequest` calls `httpClient.send`, there is no
way to stop it, the response pane prints raw `{timeMs}ms` / `{sizeBytes}B` numbers (e.g.
`1523ms` / `2097152B`), a multi-megabyte body is fed verbatim into the JSON viewer, and the Rust
`send_http_request` command has **no** integration test (only serde-shape unit tests). This
feature hardens that loop along three axes - grouped because all three touch the send path /
`src-tauri/src/lib.rs`:

- **Cancel in-flight request (#10):** a real Rust cancellation token aborts the underlying
  `reqwest` send; a **Stop** control replaces **Send** while a request is in flight.
- **Human-readable size/time + big-response guard (#11):** format `sizeBytes` as B/KB/MB and
  `timeMs` as ms/s; guard the response viewer so a body over a threshold (~2 MB) is **not** fed
  whole into CodeMirror/the JSON viewer - show a truncated preview + a notice instead.
- **Rust send integration test (#20):** exercise `send_http_request` against a mock HTTP server
  (a `[dev-dependencies]` mock crate), asserting real request build + response parse, not just
  serde round-trips.

### Scope

- **In:** Rust `cancel_http_request` command + a per-request cancellation registry; `tokio::select!`
  abort of the in-flight send; a `requestId` correlation field on the wire request; a **Stop**
  button (and the existing send shortcut acts as cancel while sending); `ResponseState` gains a
  cancelled path back to idle; `formatBytes` / `formatDuration` pure formatters used by the
  response pane; a response-body **render guard** (threshold ~2 MB) with a truncated preview +
  notice; a Rust integration test hitting a mock server (cancel + success + error paths where
  feasible).
- **Out:** streaming/chunked response rendering; partial/progressive body load; download-to-disk
  of large bodies (rejected, item #12); per-request concurrent sends (still one in-flight send
  per request id); a Rust **read cap** that truncates on the wire (we keep `sizeBytes` truthful
  and guard only at render); request **timeout** UI (already configurable via `timeoutMs`).

### Decisions captured (user)

- **Cancel:** **real Rust cancel token.** A new `cancel_http_request(requestId)` command cancels a
  `tokio_util` `CancellationToken` registered when the send starts; `tokio::select!` drops the
  `reqwest` future so the real connection is aborted (not merely a frontend result-discard).
- **Big body:** **frontend render guard (~2 MB).** Rust returns the full body and a truthful
  `sizeBytes`; the response pane refuses to feed a body larger than the threshold into the viewer,
  showing a head-truncated preview plus a "response too large to render fully" notice. No Rust
  read cap (so `sizeBytes` always reflects the true response size).
- **Rust test:** **add a mock-server dev-dependency.** `wiremock` (async, idiomatic for the async
  `reqwest` client) is the primary choice; `httpmock` is the offline fallback (already cached).
  Network at build time is required to fetch whichever is not cached - see Infra Prerequisites.

## 2. Data model & wire contract

### Wire request (`HttpRequest` / Rust `HttpRequestPayload`)

`HttpRequest` (`src/lib/http/model.ts`) and `HttpRequestPayload` (`src-tauri/src/lib.rs`) gain one
field used to correlate a cancel with its in-flight send:

```ts
type HttpRequest = {
  // ...existing: method, url, headers, body, auth, timeoutMs...
  requestId: string;   // correlation id for cancellation; unique per send invocation
};
```

- The frontend generates a fresh id per **send invocation** (`crypto.randomUUID()` - the webview
  exposes it). It is passed to `send_http_request` and reused by `cancel_http_request`.
- Rust deserializes it as `request_id` (camelCase via existing `serde(rename_all)`).
- Reusing a fresh id per send (not the node id) keeps a cancel from racing a later re-send of the
  same node.

### Response state (`ResponseState`)

No new persisted shape. The in-memory machine (`src/lib/http/model.ts`) is unchanged in its three
terminal-ish states (`idle | sending | success | error`); cancellation resolves the in-flight send
to **idle** (the pane falls back to the prior/seeded response). The send result discriminator gains
a cancelled signal so the resolve handler can distinguish "cancelled by user" from a transport
error and avoid showing the abort as an error:

```ts
type SendResult =
  | { ok: true; response: HttpResponse }
  | { ok: false; error: string; cancelled?: boolean };
```

`cancelled: true` is set when the Rust command returns its sentinel cancel error. The resolve
handler treats a cancelled result as "leave state at idle", a normal error as `{ status: "error" }`.

### HttpClient port

```ts
type HttpClient = {
  send: (req: HttpRequest) => Promise<SendResult>;
  cancel: (requestId: string) => Promise<void>;
};
```

- `tauri-client` `cancel` invokes `cancel_http_request`.
- `fake-client` `cancel` is a no-op (browser/dev has no native host); its `send` already returns a
  not-wired error.

## 3. Cancellation (Rust)

- A process-global registry `Mutex<HashMap<String, CancellationToken>>` (a `tauri::State` or a
  `once_cell`/`LazyLock` static) maps `request_id` -> token.
- `send_http_request` creates a `CancellationToken`, inserts it under `request_id`, then races the
  send with the token:

  ```rust
  tokio::select! {
      result = builder.send() => { /* existing parse path */ }
      _ = token.cancelled() => { return Err(CANCEL_SENTINEL.into()); }
  }
  ```

  The token is removed from the registry on **every** exit path (success, error, cancel) so the map
  does not leak. The body read (`response.text().await`) is also inside the race so a slow body
  download is cancellable too.
- `cancel_http_request(request_id)` looks up the token and calls `.cancel()`; a missing id is a
  no-op (the send already finished). Idempotent.
- `CANCEL_SENTINEL` is a fixed string (e.g. `"__cancelled__"`); the frontend maps exactly this
  error to `cancelled: true`.

## 4. UI

### Send / Stop control (`url-bar.tsx`)

- While `responseState(id).status === "sending"`, the **Send** button becomes a **Stop** button
  (label "Stop", same slot, a destructive/clear affordance) wired to `cancelRequest(id)`.
- The send keyboard shortcut (`Mod+Enter`) and the URL field's Enter: when already sending, they
  trigger cancel instead of a second send (re-send is still guarded). Idle -> send; sending -> stop.

### Response metrics (`response-pane.tsx`)

The status row formats the two numbers:

| raw                | formatted        |
| ------------------ | ---------------- |
| `timeMs` 1523      | `1.52s`          |
| `timeMs` 142       | `142ms`          |
| `sizeBytes` 512    | `512 B`          |
| `sizeBytes` 2048   | `2.0 KB`         |
| `sizeBytes` 2097152| `2.0 MB`         |

via pure `formatDuration(ms)` / `formatBytes(bytes)` (new, `src/lib/http/format.ts`).

### Big-body render guard (`response-pane.tsx` / `ResponseBody`)

- Threshold `RESPONSE_RENDER_LIMIT_BYTES` (~2 MB, measured on the body string length).
- A body **at or under** the threshold renders as today (filter + JSON viewer).
- A body **over** the threshold: the viewer is **not** given the full string. Instead it shows a
  head-truncated preview (the first N chars) inside a read-only block plus a notice line, e.g.
  `Response is 6.4 MB - showing the first 2.0 MB. Use a smaller request or filter.` The filter
  input is hidden or disabled in this state (JSONPath filtering a partial body would mislead).

### UI States

| State                 | Behavior                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| idle (no send yet)    | seeded/prior response or "No response" (unchanged).                             |
| sending               | "Sending…" body message; URL bar shows **Stop** (cancels on click/shortcut).    |
| sending -> cancelled  | state returns to idle; pane shows prior/seeded response or "No response"; no error.|
| success (small body)  | status row shows formatted time/size; full body + filter (unchanged).           |
| success (huge body)   | status row formatted; truncated preview + notice; filter hidden/disabled.       |
| error                 | error message (unchanged); a user cancel is **not** shown as an error.          |

## 5. Acceptance criteria

- **AC-001:** While a request is in flight, the URL bar shows a **Stop** control in place of
  **Send**; clicking it (or pressing the send shortcut) cancels the request and the response pane
  returns to idle (prior/seeded response or "No response"), with no error shown.
- **AC-002:** Cancelling invokes `cancel_http_request` with the same `requestId` the in-flight
  `send_http_request` was given; a stale result that arrives after a cancel does not overwrite a
  newer state for that request (generation-guarded).
- **AC-003 (Rust):** `send_http_request` registers a `CancellationToken` under `request_id`,
  removes it on every exit path, and a concurrent `cancel_http_request(request_id)` aborts the
  in-flight send so it resolves to the cancel sentinel error.
- **AC-004:** `formatBytes` renders B / KB / MB (e.g. `512 B`, `2.0 KB`, `2.0 MB`) and
  `formatDuration` renders ms / s (e.g. `142ms`, `1.52s`); the response status row uses them.
- **AC-005:** A response body over `RESPONSE_RENDER_LIMIT_BYTES` (~2 MB) is not fed whole into the
  viewer: a head-truncated preview plus a size notice is shown, and the filter input is
  hidden/disabled; a body at/under the threshold renders fully with the filter as today.
- **AC-006 (Rust):** An integration test sends a request through `send_http_request` against a mock
  server and asserts the parsed `HttpResponsePayload` (status, body, headers, non-zero `time_ms`,
  `size_bytes == body.len()`); an error path (unreachable host / mock 500) is also asserted.
- **AC-007:** The wire request carries `requestId`; `fake-client.cancel` is a no-op and the
  browser/dev build still builds and runs (no Tauri host) without throwing.

## 6. Test cases

- **TC-001** (happy, AC-004): `formatBytes(512)=="512 B"`, `formatBytes(2048)=="2.0 KB"`,
  `formatBytes(2_097_152)=="2.0 MB"`; `formatDuration(142)=="142ms"`,
  `formatDuration(1523)=="1.52s"`; boundary `formatBytes(1024)=="1.0 KB"`.
- **TC-002** (happy, AC-001): render the workspace, start a send (fake client that never resolves),
  assert the URL bar shows **Stop**; click Stop -> state idle, no error message, `cancel` called.
- **TC-003** (edge, AC-002): start send (gen 1), cancel, start a new send (gen 2); when the gen-1
  promise finally resolves it does not overwrite gen-2's state.
- **TC-004** (edge, AC-005): a body string > 2 MB -> response pane shows the size notice + a
  preview, the JSON viewer is not handed the full string, the filter input is absent/disabled; a
  body just under the threshold renders fully with the filter present.
- **TC-005** (edge, AC-005): a body exactly at the threshold renders fully (boundary is inclusive
  of "render").
- **TC-006** (Rust, AC-003): spawn the send against a mock that hangs; call `cancel_http_request`
  with the id; assert the send future resolves to the cancel sentinel and the registry no longer
  holds the id.
- **TC-007** (Rust, AC-006): mock returns 200 + JSON body + a header; assert status 200, body text,
  header present, `size_bytes == body.len()`. Mock returns 500; assert the command still returns
  `Ok` with status 500 (HTTP error != transport error). Unreachable URL -> `Err`.
- **TC-008** (AC-007): `buildHttpRequest` output includes a `requestId`; the fake client `cancel`
  resolves without throwing.

## 7. Edge cases

- **Cancel after completion:** `cancel_http_request` for an id already removed is a no-op (token
  gone); the frontend cancel after success just sets idle (the success state was already shown -
  guarded by status check so a completed send is not wrongly reset). Cancel is only offered while
  `status === "sending"`.
- **Double cancel / cancel with no send:** idempotent no-op both in Rust (missing id) and frontend
  (status guard).
- **Stale result race:** a send resolving after the user cancelled then re-sent must not clobber the
  newer send. A per-request generation counter (ref) captured at send time and checked on resolve
  guards this (AC-002 / TC-003).
- **`requestId` collision:** `crypto.randomUUID()` per send invocation; collision is not defended
  beyond UUID uniqueness.
- **Body exactly at threshold:** inclusive - rendered fully (TC-005).
- **Non-JSON huge body:** the guard is on byte length, independent of JSON validity; a huge plain
  body is truncated-previewed the same way.
- **`time_ms` zero on a near-instant mock:** the test asserts `>= 0` (not strictly `> 0`) to avoid
  flaking on a sub-millisecond local mock; `size_bytes == body.len()` is the strict assertion.
- **`tokio::select!` body-read cancel:** cancelling during the body download (not just the initial
  send) also aborts; both awaits sit inside the select.

## 8. Dependencies

- **Rust:** `tokio` (direct dep, features `sync` + `macros` + `rt-multi-thread` for `select!`,
  `#[tokio::test]`) and `tokio-util` (feature for `CancellationToken`) move from transitive to
  direct deps. A mock-server `[dev-dependencies]` crate (`wiremock` primary, `httpmock` cached
  fallback). No new npm dependency.
- **Frontend:** reuses `Input`, `Button`, `Tabs`, `JsonViewer`, `filterJson`, the existing send
  loop in `workspace-context.tsx`, the `HttpClient` port + both adapters, and the send shortcut.
  New pure module `src/lib/http/format.ts`.

## 9. Open questions

- None blocking. (Cancel mechanism, big-body strategy, and test infra resolved with the user.)
