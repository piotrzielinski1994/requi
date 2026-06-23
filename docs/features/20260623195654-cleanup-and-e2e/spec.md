# Spec: Cleanup + E2E harness (scaffold removal + Playwright on the dev browser build)

**Version:** 0.1.0
**Created:** 2026-06-23
**Status:** Draft

## 1. Overview

Two grouped concerns from the backlog (`.pzielinski/todos.md` feature #8, items #18 + #23):

- **Cleanup (#18):** delete the Tauri scaffold dead code (`greet` Rust command + its tests +
  the dead `src/lib/tauri.ts` wrapper) and tidy `mock-data.ts` - today a confusing dual-purpose
  module (a **type re-export hub** for 12 consumers _plus_ unused seed data `mockTree` /
  `mockConsoleLines` that the prod loader and every test already bypass by passing `tree`
  explicitly).
- **E2E (#23):** add a **Playwright** harness that drives real UI flows in the `npm run dev`
  browser build. Per the standing todos decision, Playwright exercises UI flows **against the
  fakes** (in-memory fs, fake HTTP), _not_ the native Rust/WebView boundary - that stays covered
  by `cargo test` + manual testing. Native Tauri E2E (`tauri-driver`) is explicitly **out**: it
  cannot run on macOS (Apple ships no WebDriver for embedded WKWebView), so it would be
  Linux-CI-only and undebuggable locally - rejected by the user.

The two concerns are coupled by one fact: the `npm run dev` browser build currently renders only
the **empty state** (the Tauri adapters no-op with no host), so there is nothing for Playwright to
drive. This feature wires the dev-browser build to fakes seeded with a demo workspace - which
simultaneously **promotes `mockTree` from dead seed to the live demo seed**, resolving the
cleanup smell, and gives Playwright a real app to exercise.

### Scope

- **In:**
  - Remove `greet` (Rust `fn greet` + `invoke_handler` entry + its two unit tests) and delete
    `src/lib/tauri.ts` (its dead TS wrapper, zero consumers).
  - Repoint the 12 `import type ... from "@/components/workspace/mock-data"` consumers to the
    real source `@/lib/workspace/model`; move the seed data to a new `src/lib/workspace/demo-seed.ts`
    (`demoTree` / `demoConsoleLines`); delete `mock-data.ts`; drop the `WorkspaceProvider`
    `tree` / `consoleLines` defaults to `[]` (no prod/test path relies on them).
  - A runtime discriminator `isDevBrowser()` and a dev-only adapter wiring so the `npm run dev`
    build renders the demo workspace (interactive) instead of the empty state.
  - A Playwright config + `npm run e2e` script + a small set of E2E specs (`tests/e2e/*.e2e.ts`)
    driving load / open-request / send / command-palette flows against the fakes.
  - Relocate the existing jsdom routing test `tests/e2e/bootstrap.spec.tsx` to
    `tests/integration/` so `tests/e2e/` is Playwright-only (it is a jsdom test mis-filed under
    "e2e"; it stays a Vitest test).
  - Doc updates (README repo layout + commands, CLAUDE.md if a new convention lands).
- **Out:**
  - Native `tauri-driver` / WebdriverIO E2E (macOS-incompatible; rejected).
  - Any new product feature or visual design - the dev build reuses the existing workspace
    layout verbatim, just fed seed data.
  - CI wiring (`.github/workflows`) - none exists yet; not adding one this feature (the Playwright
    config is CI-aware via `reuseExistingServer`/`process.env.CI` so a future CI job is a one-liner).
  - Touching the Rust send/cancel logic or its `wiremock` integration tests.
  - Coverage thresholds (none enforced today).

### Decisions captured (user)

- **E2E approach:** Playwright against the dev-browser build wired to fakes. Native Tauri E2E
  rejected (macOS cannot run it locally; `cargo test` already covers the real Rust boundary).
- **Dev-build wiring:** the non-Tauri **development** build seeds a demo workspace so the app is
  fully interactive in the browser - which makes `mockTree` a live demo seed rather than dead code.

## 2. Cleanup detail

### 2.1 `greet`

- `src-tauri/src/lib.rs`: delete `fn greet`, its `greet,` entry in `tauri::generate_handler![...]`,
  and the two tests `should_greet_with_name_when_given_one` /
  `should_greet_with_empty_name_when_name_is_blank`. Everything else (`send_http_request`,
  `cancel_http_request`, the cancel registry, the serde + `wiremock` tests) is untouched.
- `src/lib/tauri.ts`: delete the file - it only exports `greet(name)` (an `invoke<string>("greet")`
  wrapper) and has **zero** importers in `src/`.

### 2.2 `mock-data.ts`

Today `src/components/workspace/mock-data.ts`:

1. **re-exports types** (`HttpMethod`, `KeyValue`, `BodyMode`, `Auth`, `ScriptConfig`,
   `ConfigScope`, `RequestResponse`, `RequestNode`, `FolderNode`, `TreeNode`) that actually live
   in `@/lib/workspace/model` - 12 files import these via the `mock-data` indirection;
2. exports seed data `mockTree` / `mockConsoleLines`, used only as the `WorkspaceProvider`
   `tree` / `consoleLines` **default** prop values. The prod loader (`workspace-loader.tsx`)
   always passes `tree` explicitly, and every test passes `tree` - so the defaults are dead.

Cleanup:

- Repoint all 12 `import type { ... } from "@/components/workspace/mock-data"` to
  `@/lib/workspace/model` (the canonical source). Consumers (confirmed): `key-value-table.tsx`,
  `tree-row.tsx`, `url-bar.tsx`, `content-header.tsx`, `editable-key-value-table.tsx`,
  `__tests__/fixtures.ts`, `request-pane.tsx`, `workspace-context.tsx`, `response-pane.tsx`,
  `method-color.ts`, `config-panels.tsx`, `body-panel.tsx`.
- Move the seed data verbatim into `src/lib/workspace/demo-seed.ts` exporting `demoTree:
  TreeNode[]` and `demoConsoleLines: string[]` (renamed from `mockTree` / `mockConsoleLines`).
- In `workspace-context.tsx`, drop the `mock-data` import and default `tree = []`,
  `consoleLines = []` (the empty-state defaults; no path depends on the old seed default - the
  "no `tree=` prop" scan over `src/` + `tests/` returned nothing).
- Delete `src/components/workspace/mock-data.ts`.

## 3. Dev-browser adapter wiring

### 3.1 Environment discriminator

`src/lib/runtime/environment.ts`:

```ts
import { isTauri } from "@tauri-apps/api/core";

// True only in the `npm run dev` browser build: Vite dev mode AND no Tauri host.
// - `npm run dev`  -> MODE "development", isTauri() false  -> true
// - `npm start`    -> MODE "development", isTauri() true   -> false (native adapters)
// - vitest         -> MODE "test"                          -> false (empty-state default)
// - `npm run build`-> MODE "production"                    -> false (native adapters)
export function isDevBrowser(): boolean {
  return import.meta.env.MODE === "development" && !isTauri();
}
```

The `MODE === "development"` guard (not `import.meta.env.DEV`) is load-bearing: under Vitest
`DEV` is also `true`, so gating on `DEV` would seed the demo tree into the jsdom tests and break
the empty-state expectations. `MODE` is `"development"` only under `vite` (`npm run dev` / `npm
start`), `"test"` under Vitest, `"production"` under build.

### 3.2 Demo seed + adapters

`src/lib/workspace/demo-seed.ts` (alongside `demoTree`/`demoConsoleLines`):

- `DEMO_WORKSPACE_PATH = "demo"` - the in-memory fs key + the dev settings `workspacePath`.
- `demoFiles()` -> `FileMap` = `serialize(demoTree, "Demo")` (the loader reads this via
  `deserialize`, so the seed round-trips through the real disk format, not a shortcut).

Dev adapters (created where the Tauri ones are today):

- **`routes/__root.tsx`** - settings store: `isDevBrowser()` ?
  `createInMemorySettingsStore({ ...DEFAULT_SETTINGS, workspacePath: DEMO_WORKSPACE_PATH })`
  : `createTauriSettingsStore()`. The non-empty `workspacePath` is what makes `WorkspaceLoader`
  load instead of showing the empty state.
- **`routes/index.tsx`** - when `isDevBrowser()`:
  - `fs` = `createInMemoryWorkspaceFs({ [DEMO_WORKSPACE_PATH]: demoFiles() })`
  - `picker` = `createNoopFolderPicker()`
  - `httpClient` = `createFakeHttpClient({ ok: true, response: DEMO_RESPONSE })` where
    `DEMO_RESPONSE` is a canned 200 JSON payload (so the Send flow shows a real success response)
  - `scriptRunner` = `createQuickJsScriptRunner()` (QuickJS single-file WASM runs in the browser -
    unchanged from native; scripts work in the dev build too)
  - otherwise the existing Tauri adapters.

No change to `WorkspaceLoader`, `WorkspaceProvider`, or any pane - they already accept these ports.

## 4. Playwright harness

- New dev dep `@playwright/test`. Browsers installed via `npx playwright install` (prereq).
- `playwright.config.ts`:
  - `testDir: "tests/e2e"`, `testMatch: /.*\.e2e\.ts$/` (so Vitest's `*.spec` / `*.test` files
    are never picked up by Playwright, and Playwright's `.e2e.ts` files are never picked up by
    Vitest - the two runners are partitioned by file extension).
  - `webServer: { command: "npm run dev", url: "http://localhost:1430", reuseExistingServer:
    !process.env.CI }` (Vite's fixed `strictPort` 1430).
  - `use: { baseURL: "http://localhost:1430" }`, Chromium project (the app targets one WebView;
    one browser is enough).
- `package.json`: `"e2e": "playwright test"`.
- Relocate `tests/e2e/bootstrap.spec.tsx` -> `tests/integration/bootstrap.spec.tsx` (still a
  Vitest jsdom test; `tests/e2e/` becomes Playwright-only). Vitest `include` already covers
  `tests/**/*.spec.{ts,tsx}`.

### E2E specs (`tests/e2e/`)

- `workspace.e2e.ts` - load + open + send:
  - the demo tree renders (a known node label is visible) instead of the empty state;
  - clicking/expanding to a request opens its tab and the URL bar shows its url;
  - clicking **Send** shows the canned 200 response (status + body) in the response pane.
- `command-palette.e2e.ts` - palette flow:
  - `Mod+K` opens the command palette overlay (lists actions);
  - running **New request** (via the palette) opens a new request tab.

## 5. UI

**No new UI and no new visual design.** The dev-browser build renders the existing workspace
layout (sidebar tree, tabs, panes, console) fed by the demo seed - identical to the native app
viewing a workspace. No wireframes required (nothing visual is being designed; the visual contract
in `docs/design.md` is unchanged).

### UI States

| State                        | Behavior                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev` (browser)      | demo workspace loads + is interactive (tree, tabs, send shows canned response). |
| `npm start` (Tauri dev)      | unchanged - real native adapters, loads the configured `workspacePath`.         |
| `npm run build` / packaged   | unchanged - real native adapters.                                               |
| Vitest (jsdom)               | unchanged - empty state at `/` (the relocated bootstrap test still passes).     |

## 6. Acceptance criteria

- **AC-001:** `greet` is fully removed - `src-tauri/src/lib.rs` has no `fn greet`, no `greet`
  entry in `generate_handler!`, and no `greet` tests; `cargo test` passes (the remaining
  send/cancel/serde/wiremock tests are green and unchanged in count minus the two greet tests).
- **AC-002:** `src/lib/tauri.ts` is deleted and nothing imports it; `npm run typecheck` and
  `npm run build` pass.
- **AC-003:** `src/components/workspace/mock-data.ts` is deleted; the 12 former consumers import
  the types from `@/lib/workspace/model`; the seed lives in `src/lib/workspace/demo-seed.ts` as
  `demoTree` / `demoConsoleLines`; `WorkspaceProvider` defaults `tree`/`consoleLines` to `[]`; the
  full Vitest suite is green.
- **AC-004:** `isDevBrowser()` returns `true` only for Vite development with no Tauri host
  (`MODE === "development" && !isTauri()`), and `false` under Vitest (`MODE === "test"`),
  production build, and a Tauri host - proven by unit tests stubbing `import.meta.env.MODE` and
  `isTauri`.
- **AC-005:** In the `npm run dev` build the app wires in-memory fs + fake HTTP + noop picker +
  a demo settings store (`workspacePath = "demo"`) seeded with `demoTree` (round-tripped through
  `serialize`/`deserialize`), so the workspace renders the demo tree instead of the empty state;
  `npm start` and the Vitest empty-state behavior are unchanged.
- **AC-006:** A Playwright harness exists: `playwright.config.ts` runs `npm run dev` as its
  `webServer` on `:1430`, `testDir` is `tests/e2e` with `testMatch` `*.e2e.ts`, an `npm run e2e`
  script runs it, and it does **not** collide with the Vitest suite (Vitest never runs `.e2e.ts`;
  Playwright never runs `.spec`/`.test`).
- **AC-007:** The E2E specs pass against the dev build: (a) the demo tree loads and a request tab
  opens with its URL shown; (b) **Send** shows the canned 200 response; (c) `Mod+K` opens the
  command palette and **New request** opens a new tab.
- **AC-008:** The relocated `tests/integration/bootstrap.spec.tsx` still passes under Vitest
  (routing / empty-state / settings-tab behavior unchanged).

## 7. Test cases

- **TC-001** (Rust, AC-001): `cargo test` passes; `grep -c greet src-tauri/src/lib.rs` is `0`.
- **TC-002** (build/types, AC-002/AC-003): `npm run typecheck` + `npm run build` pass with
  `src/lib/tauri.ts` and `mock-data.ts` removed and imports repointed.
- **TC-003** (unit, AC-004): `isDevBrowser` - returns `true` for `{ MODE: "development",
  isTauri: false }`; `false` for `{ MODE: "development", isTauri: true }`, `{ MODE: "test" }`,
  `{ MODE: "production" }`. (`import.meta.env.MODE` stubbed via `vi.stubEnv`; `isTauri` mocked.)
- **TC-004** (integration, AC-005): rendering the index/loader wiring with the dev adapters (an
  in-memory fs seeded with `demoFiles()` + demo settings store) shows the demo tree, not the
  empty state. (Drives the same loader path the dev build uses, with the ports injected - WASM-
  and browser-free, like the other context tests.)
- **TC-005** (unit, AC-003/AC-005): `demoFiles()` round-trips - `deserialize(demoFiles()).tree`
  deep-equals `demoTree` (the seed survives the real disk format).
- **TC-006** (e2e, AC-007a): demo tree loads; open a request; the URL bar shows its url.
- **TC-007** (e2e, AC-007b): Send -> the response pane shows the canned 200 + body.
- **TC-008** (e2e, AC-007c): `Mod+K` opens the palette; running **New request** opens a new tab.
- **TC-009** (Vitest, AC-008): the relocated `bootstrap.spec.tsx` cases pass from
  `tests/integration/`.

## 8. Edge cases

- **`import.meta.env.MODE` typing:** `tsc` needs Vite client types for `import.meta.env`. If not
  already resolved, add `vite/client` to the tsconfig `types` (or a triple-slash reference in the
  env module). Verified by `npm run typecheck`.
- **Vitest picking up `.e2e.ts`:** prevented by extension - Vitest `include` is `*.spec`/`*.test`
  only. The relocation of `bootstrap.spec.tsx` keeps it under the `tests/**/*.spec` glob.
- **Playwright picking up Vitest files:** prevented by `testMatch: /.*\.e2e\.ts$/` (overrides
  Playwright's default `spec|test` match).
- **Port 1430 already in use:** Vite is `strictPort` - it fails fast. `reuseExistingServer`
  (non-CI) reuses a running dev server; CI always starts fresh. Document killing strays
  (CLAUDE.md already mandates this).
- **QuickJS WASM in the dev browser:** already proven to work (single-file variant; learnings
  #121) - scripts run in `npm run dev` exactly as native.
- **`WorkspaceProvider` default change to `[]`:** confirmed no test or prod path renders the
  provider without a `tree` prop, so the seed default was genuinely dead; the empty default is
  safe.
- **Playwright not installed / no browsers:** `npm run e2e` fails fast with Playwright's own
  "run `npx playwright install`" message; documented as a prereq.

## 9. Dependencies

- **New dev dep:** `@playwright/test` (+ `npx playwright install` for browsers - a local/CI
  prereq, not an npm dep).
- **No new runtime npm dep, no new Rust crate.** Reuses existing fakes (`createFakeHttpClient`,
  `createInMemoryWorkspaceFs`, `createInMemorySettingsStore`, `createNoopFolderPicker`),
  `serialize`/`deserialize`, and `isTauri` from `@tauri-apps/api/core` (already present).
- New files: `src/lib/runtime/environment.ts`, `src/lib/workspace/demo-seed.ts`,
  `playwright.config.ts`, `tests/e2e/*.e2e.ts`. Moved: `tests/e2e/bootstrap.spec.tsx` ->
  `tests/integration/`. Deleted: `src/lib/tauri.ts`, `src/components/workspace/mock-data.ts`.

## 10. Open questions

- None blocking. E2E approach (Playwright-on-fakes, no native driver) and the dev-build seeding
  are resolved with the user.
