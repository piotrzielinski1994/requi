# Spec: Send request, read response, filter response

**Version:** 0.1.0
**Created:** 2026-06-20
**Status:** Draft

## 1. Overview

The app renders a full request/response workspace but cannot actually talk to the network:
the **Send** button, the method selector and the URL display are all read-only, and the
response pane shows seeded mock data. This feature wires the core HTTP loop:

- **Edit** the active request's URL and method in-memory (like body edits today).
- **Send** the request through a new `HttpClient` port (Tauri command backed by `reqwest`
  in the Rust shell - the webview cannot do cross-origin HTTP itself), applying the
  request's **resolved** config: `{{var}}` substitution, query params, headers, auth,
  timeout, and body.
- **Read** the live response (status, time, size, body, headers) with loading / error /
  success states.
- **Filter** the response body by a JSONPath-ish expression (`$.args.foo`, `$.headers[0]`)
  to narrow what's shown.

Reference endpoint for manual testing: `https://postman-echo.com/get` (echoes method,
headers, and query args back as JSON).

### Why a Rust command (not `fetch` in the webview)

A Tauri webview is subject to CORS; arbitrary cross-origin requests fail. Routing HTTP
through a Rust `#[tauri::command]` (using `reqwest`) bypasses CORS and is the standard Tauri
pattern. It also keeps the network layer behind the same **port/adapter** seam the project
already uses for `fs` and `folder-picker`, so component tests inject a fake client and never
hit the network.

### Scope decisions (from product Q&A)

- **Send = full config**: editable URL+method, and on send apply the resolved headers,
  query params, auth, timeout, `{{var}}` substitution and body (reuses `resolveConfig`).
- **Filter = JSONPath subset extraction**: dot + `[index]` navigation, hand-rolled minimal
  evaluator (no new dep), matching the existing placeholder `$.data.items[0]`.
- **In-memory only**: URL/method edits live in session state (mirrors body edits); no disk
  write (disk save is a separate, still-unbuilt feature).

## 2. Acceptance Criteria

### Editing

- AC-001: The URL bar is an editable text field; typing updates the active request's `url`
  in session state (the underlying tree/draft node is not mutated; closing+reopening a tree
  request reverts it, consistent with body edits).
- AC-002: The method selector is interactive; choosing a method updates the active request's
  `method` in session state.

### Sending

- AC-003: Clicking **Send** issues exactly one HTTP request through the `HttpClient` port
  with the resolved method, final URL, headers, auth, timeout and (for non-GET) body.
- AC-004: Before sending, `{{var}}` tokens in the URL and in header/param values are
  substituted from the effective `variables`, and the resolved query params are appended to
  the URL as a query string (existing `?`-query in the URL is preserved/merged).
- AC-005: While a request is in flight the response pane shows a **loading** state and the
  Send control is disabled (no second concurrent send for the same request).
- AC-006: On success the response pane shows the status, elapsed time (ms), size (bytes),
  body, and response headers.
- AC-007: On failure (invalid URL, DNS/network error, timeout) the response pane shows a
  readable **error** message and the app does not crash; the request can be re-sent.

### Shortcut

- AC-008: `send-request` is a wired, rebindable shortcut (default `Mod+Enter`) and appears as
  a command-palette command; running it sends the active request (no-op when no request is
  active). Keeps the README invariant "every wired action has a configurable shortcut".

### Filtering

- AC-009: Typing a JSONPath (`$.foo`, `$.a.b[0]`) in the response filter narrows the shown
  body to the matched subtree (objects/arrays pretty-printed, scalars shown raw).
- AC-010: An empty filter shows the full response body.
- AC-011: A path that matches nothing, or that is run against a non-JSON / empty body, shows
  a clear "no match" indication (not a crash); clearing the filter restores the full body.

## 3. User test cases

- TC-001 (happy path, GET): seed a request at `https://postman-echo.com/get`, click Send ->
  loading -> 200 with JSON body echoing the request. Maps to: AC-003, AC-005, AC-006.
- TC-002 (var + params): URL `{{baseUrl}}/get` with `baseUrl=https://postman-echo.com` and a
  query param `foo=bar` -> final URL `https://postman-echo.com/get?foo=bar`. Maps to: AC-004.
- TC-003 (edit url/method): type a new URL and pick POST; the active request reflects both;
  reopening from the tree reverts. Maps to: AC-001, AC-002.
- TC-004 (error): Send to an unreachable/invalid host -> error state shown, no crash, Send
  re-enabled. Maps to: AC-007.
- TC-005 (shortcut): `Mod+Enter` sends the active request; rebinding it in settings changes
  the trigger; nothing happens with no active request. Maps to: AC-008.
- TC-006 (filter extract): on a 200 JSON body, `$.args.foo` shows just that value; `$.headers`
  shows that subtree. Maps to: AC-009.
- TC-007 (filter empty / no match): empty filter -> full body; `$.nope` -> "no match";
  filter on non-JSON body -> "no match". Maps to: AC-010, AC-011.

## 4. UI States

Response pane (priority): a live send state for the active request wins; with no send yet,
the seeded mock response (if any) shows; otherwise "No response".

| State   | Behavior                                                                 |
| ------- | ------------------------------------------------------------------------ |
| Idle    | No send issued: seeded response if present, else "No response".          |
| Loading | Request in flight: "Sending…", Send disabled, filter/tabs inert.         |
| Error   | Failure: red error message with the reason; Send re-enabled.             |
| Success | Status/time/size in the header; body in Response tab; headers in Headers. |

### Wireframes

URL bar (editable URL field + live method select + Send; Send disabled while sending):

```
+--------+------------------------------------------------+--------+
| GET  v | https://postman-echo.com/get                   |  Send  |
+--------+------------------------------------------------+--------+
```

Response - Loading:

```
+-------------------------------------------------------------------+
| [ Response ][ Headers ]                                           |
+-------------------------------------------------------------------+
|                                                                   |
|                          Sending…                                 |
|                                                                   |
+-------------------------------------------------------------------+
```

Response - Success (status / time / size on the right of the tab row):

```
+-------------------------------------------------------------------+
| [ Response ][ Headers ]                      200   142ms   248B   |
+-------------------------------------------------------------------+
| {                                                                 |
|   "args": { "foo": "bar" },                                       |
|   "headers": { ... },                                             |
|   "url": "https://postman-echo.com/get?foo=bar"                   |
| }                                                                 |
+-------------------------------------------------------------------+
| $.args.foo                                                        |
+-------------------------------------------------------------------+
```

Response - Success + active filter `$.args` (body narrowed to the subtree):

```
+-------------------------------------------------------------------+
| [ Response ][ Headers ]                      200   142ms   248B   |
+-------------------------------------------------------------------+
| {                                                                 |
|   "foo": "bar"                                                    |
| }                                                                 |
+-------------------------------------------------------------------+
| $.args                                                            |
+-------------------------------------------------------------------+
```

Response - Error:

```
+-------------------------------------------------------------------+
| [ Response ][ Headers ]                                           |
+-------------------------------------------------------------------+
|                                                                   |
|   Request failed: error sending request for url (...): dns error  |
|                                                                   |
+-------------------------------------------------------------------+
```

## 5. Data model

New pure types (frontend, `src/lib/http/`):

```ts
type HttpRequest = {
  method: HttpMethod;
  url: string;            // final, vars substituted, query appended
  headers: KeyValue[];    // resolved, values substituted
  body: string | null;    // null for GET / empty
  auth: Auth;             // resolved (bearer/basic/none)
  timeoutMs: number;
};

type HttpResponse = RequestResponse; // { status, timeMs, sizeBytes, body, headers }

type SendResult =
  | { ok: true; response: HttpResponse }
  | { ok: false; error: string };

type HttpClient = { send: (req: HttpRequest) => Promise<SendResult> };

type ResponseState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "success"; response: HttpResponse }
  | { status: "error"; message: string };
```

`WorkspaceProvider` session state additions:

- `requestOverrides: Map<id, Partial<Pick<RequestNode,"url"|"method"|"body">>>` -
  generalizes today's `bodyOverrides`; `setRequestBody/Url/Method` write fields into it;
  `requestsById` applies `{ ...base, ...override }`. `closeRequest`/`closeAllRequests` clear
  it exactly as the body map is cleared today.
- `responseStates: Map<id, ResponseState>` - per-request send state; cleared on close.

Rust (`src-tauri/`): a `send_http_request` command taking the serialized `HttpRequest`,
returning `Result<HttpResponse, String>` (reqwest; elapsed measured around `send`).

## 6. Edge cases

- Empty / malformed URL -> Rust send errors -> error state (AC-007).
- DNS / connection refused / TLS error -> error state with reqwest's message.
- Timeout -> `reqwest` per-request timeout from resolved `timeoutMs` -> error state.
- GET/DELETE with a non-empty body -> body omitted (only sent for methods that take one).
- Non-JSON or empty success body -> shows raw body; filtering it yields "no match".
- Filter on array index out of range / missing key -> "no match", body restorable by clearing.
- Draft request (id `draft-n`, not on disk) -> sends fine (uses in-memory node + default config).
- Double-send -> blocked while `sending` (AC-005).
- Very large response body -> shown as-is (no truncation/streaming); explicitly out of scope.

## 7. Dependencies

- New Rust crate: `reqwest` (async, rustls TLS to avoid a system OpenSSL dependency).
- New capability: none for the command itself (commands are allowed by default); reqwest
  opens outbound sockets from the Rust process, not the webview, so no `fs`/`http` scope
  entries are required. (No `@tauri-apps/plugin-http` - we own the command.)
- No new frontend npm dependency (JSONPath evaluator is hand-rolled).
