# Plan: Cleanup + E2E harness

From the approved [spec.md](spec.md). TDD order. Two grouped concerns: scaffold cleanup
(#18) and a Playwright E2E harness on the dev-browser build (#23). Mostly mechanical; the one
real design decision (dev-build seeding) is what un-deads `mock-data.ts`.

## Approach

Five layers, sequenced so each lands behind its own check. The cleanup layers are
behavior-preserving refactors (no test should change meaning); the wiring + E2E layers are new
behavior gated to the `npm run dev` build only.

1. **`greet` removal** (`src-tauri/src/lib.rs` + delete `src/lib/tauri.ts`). Pure dead-code
   deletion - `greet` has zero non-test consumers on either side.
2. **`mock-data.ts` split** - repoint 12 type-importers to `@/lib/workspace/model`; move the seed
   to `src/lib/workspace/demo-seed.ts` (`demoTree`/`demoConsoleLines`); delete `mock-data.ts`;
   default `WorkspaceProvider` `tree`/`consoleLines` to `[]`.
3. **`isDevBrowser()`** (`src/lib/runtime/environment.ts`) - the `MODE==="development" &&
   !isTauri()` discriminator, behind unit tests.
4. **Dev-build adapter wiring** (`routes/__root.tsx` + `routes/index.tsx`) - when `isDevBrowser()`,
   inject in-memory fs (seeded `demoFiles()`) + fake HTTP (canned 200) + noop picker + demo
   settings store (`workspacePath="demo"`). `npm start` / build / vitest paths untouched.
5. **Playwright harness** (`playwright.config.ts`, `npm run e2e`, `tests/e2e/*.e2e.ts`) +
   relocate the mis-filed jsdom `bootstrap.spec.tsx` -> `tests/integration/`.

`buildHttpRequest`, the panes, `WorkspaceLoader`, `WorkspaceProvider` internals, and the Rust
send/cancel logic are **not** modified.

## File changes

**Cleanup:**
- `src-tauri/src/lib.rs` - delete `fn greet`, its `greet,` line in `generate_handler!`, and the two
  `should_greet_*` tests. Nothing else.
- `src/lib/tauri.ts` - **delete** (dead `greet` wrapper, zero importers).
- `src/components/workspace/mock-data.ts` - **delete**.
- `src/lib/workspace/demo-seed.ts` - **new**: `demoTree: TreeNode[]`, `demoConsoleLines: string[]`
  (the verbatim seed from `mock-data.ts`, renamed), `DEMO_WORKSPACE_PATH = "demo"`,
  `DEMO_RESPONSE` (canned 200 JSON `HttpResponse`), `demoFiles(): FileMap = serialize(demoTree,
  "Demo")`.
- Repoint type imports `@/components/workspace/mock-data` -> `@/lib/workspace/model` in the 12
  consumers: `key-value-table.tsx`, `tree-row.tsx`, `url-bar.tsx`, `content-header.tsx`,
  `editable-key-value-table.tsx`, `__tests__/fixtures.ts`, `request-pane.tsx`,
  `workspace-context.tsx`, `response-pane.tsx`, `method-color.ts`, `config-panels.tsx`,
  `body-panel.tsx`.
- `src/components/workspace/workspace-context.tsx` - drop the `mock-data` import; default
  `tree = []`, `consoleLines = []`.

**Environment discriminator:**
- `src/lib/runtime/environment.ts` - **new**: `isDevBrowser()` per spec §3.1. (If `import.meta.env`
  typing trips `tsc`, add `vite/client` to tsconfig `types` or a triple-slash reference here.)

**Dev-build wiring:**
- `src/routes/__root.tsx` - `settingsStore = isDevBrowser() ? createInMemorySettingsStore({
  ...DEFAULT_SETTINGS, workspacePath: DEMO_WORKSPACE_PATH }) : createTauriSettingsStore()`
  (kept in `useState` initializer so it's created once).
- `src/routes/index.tsx` - when `isDevBrowser()`, swap the four ports: `createInMemoryWorkspaceFs({
  [DEMO_WORKSPACE_PATH]: demoFiles() })`, `createFakeHttpClient({ ok:true, response: DEMO_RESPONSE
  })`, `createNoopFolderPicker()`, `createQuickJsScriptRunner()` (unchanged - runs in browser);
  else the existing Tauri adapters.

**Playwright:**
- `playwright.config.ts` - **new**: `testDir:"tests/e2e"`, `testMatch:/.*\.e2e\.ts$/`,
  `webServer:{ command:"npm run dev", url:"http://localhost:1430",
  reuseExistingServer:!process.env.CI }`, `use:{ baseURL:"http://localhost:1430" }`, Chromium
  project.
- `package.json` - add devDep `@playwright/test`; add script `"e2e":"playwright test"`.
- `tests/e2e/workspace.e2e.ts` - **new**: demo tree loads / open request shows url / Send -> canned
  200 (TC-006, TC-007).
- `tests/e2e/command-palette.e2e.ts` - **new**: `Mod+K` opens palette / New request opens a tab
  (TC-008).
- `tests/e2e/bootstrap.spec.tsx` -> **move** to `tests/integration/bootstrap.spec.tsx` (unchanged
  content; still a Vitest jsdom test).

**Docs:**
- `README.md` - repo-layout sketch (`tests/e2e/` = Playwright, `tests/integration/` = jsdom;
  `src/lib/runtime/`, `demo-seed.ts`); commands table gains `npm run e2e`. Note that `npm run dev`
  now loads a demo workspace.
- `CLAUDE.md` / `docs/learnings.md` - the test-layer split convention (`*.e2e.ts` = Playwright on
  the dev-browser-against-fakes build; `*.spec`/`*.test` = Vitest) + the `isDevBrowser()` seam.

## Approaches considered (Decision Log candidates)

- **Dev-build discriminator: `MODE==="development" && !isTauri()`** vs `import.meta.env.DEV`.
  Chose `MODE` because Vitest also sets `DEV=true`; gating on `DEV` would seed the demo tree into
  jsdom tests and break the empty-state expectations. `MODE` is `"test"` under Vitest. **Recorded.**
- **Seed via `demoFiles()` (round-trip through `serialize`/`deserialize`)** vs passing `demoTree`
  straight to the provider. Chose the round-trip so the dev build exercises the real disk-format
  load path (and the seed can't silently drift from a shape the loader rejects). **Recorded.**
- **Runner partition by file extension (`*.e2e.ts` vs `*.spec`/`*.test`)** vs separate root dirs
  only. Chose extension match - robust even if a file is mis-filed (the existing `bootstrap.spec`
  proved that risk). **Recorded.**

## Edge cases handled (from spec §8)

- `import.meta.env.MODE` typing -> `vite/client` types if `tsc` complains (verify via typecheck).
- Vitest vs Playwright file pickup -> partitioned by extension (`testMatch` + the `include` glob).
- Port 1430 in use -> Vite `strictPort` fails fast; `reuseExistingServer` non-CI; doc kill-strays.
- QuickJS WASM in dev browser -> already proven (learnings #121); no change.
- `WorkspaceProvider` default `[]` -> confirmed no path renders it without `tree` (scan returned
  nothing), so the empty default is safe.
- Playwright not installed -> `npm run e2e` fails with its own install hint; documented prereq.

## Tests to write (RED first)

Unit / integration (Vitest):
- `environment.test.ts` - `isDevBrowser()` truth table (TC-003/AC-004): true for
  `{development, !tauri}`; false for `{development, tauri}`, `{test}`, `{production}`
  (`vi.stubEnv("MODE", …)` + mock `isTauri`).
- `demo-seed.test.ts` - `deserialize(demoFiles()).tree` deep-equals `demoTree` (TC-005/AC-003/005).
- `dev-wiring` integration - render the loader with the dev adapters (in-memory fs seeded with
  `demoFiles()` + demo settings store) -> demo tree shows, not the empty state (TC-004/AC-005).
  WASM-free (fake/noop ports), like the other context tests.
- existing suite stays green after the `mock-data` repoint + `greet` removal (AC-002/003) - the
  net for the cleanup.

E2E (Playwright, against `npm run dev`):
- `workspace.e2e.ts` - demo tree loads + a request tab opens with its url (TC-006/AC-007a); Send ->
  canned 200 in the response pane (TC-007/AC-007b).
- `command-palette.e2e.ts` - `Mod+K` opens the palette; **New request** opens a tab
  (TC-008/AC-007c).

Rust:
- `cargo test` green after `greet` removal; `grep -c greet src-tauri/src/lib.rs` == 0 (TC-001/AC-001).

## Execution order

1. RED: spawn fresh test-writer subagent (skill Phase 3) for the Vitest unit/integration tests
   (TC-003/004/005) + confirm they fail. (E2E specs are written in the GREEN phase - they need the
   dev wiring to exist to run at all; they're authored to assert the spec'd flows and run last.)
2. GREEN:
   a. `greet` removal -> commit `chore(cleanup-and-e2e): AC-001 remove greet scaffold command + dead tauri.ts`.
      Run `cargo test` + `npm run typecheck`.
   b. `mock-data.ts` split + repoint + provider defaults -> commit
      `refactor(cleanup-and-e2e): AC-003 split mock-data into demo-seed + model type imports`.
      Run `npm test` + `npm run typecheck` (full suite green = behavior preserved).
   c. `isDevBrowser()` -> commit `feat(cleanup-and-e2e): AC-004 isDevBrowser runtime discriminator`.
   d. dev-build adapter wiring -> commit `feat(cleanup-and-e2e): AC-005 seed dev-browser build with demo workspace + fakes`.
   e. Playwright config + scripts + specs + relocate bootstrap test -> commit
      `test(cleanup-and-e2e): AC-006/007/008 playwright harness on the dev-browser build`.
3. REFACTOR: tidy the dev/native adapter branch in `routes/index.tsx` if it grows ifology (a small
   `createDevAdapters()` / `createNativeAdapters()` split); keep green.
4. VERIFY: fresh verifier subagent. Gates: `npm test` (Vitest, all green), `npm run typecheck`,
   `npm run lint`, `cargo test` (Rust, green minus the 2 greet tests), `npm run e2e` (Playwright,
   green - run locally on macOS).

## Acceptance verification

- AC-001..008 each map to a named test/gate (trace table filled after verify).
- Gates: Vitest all-green, `tsc` clean (no `any`), eslint clean, `cargo test` green, `npm run e2e`
  green. No coverage threshold enforced in the project (confirmed - no jest/vitest threshold,
  no `.nycrc`).

## Risks

- **Playwright flakiness on the dev server.** First-run can race the Vite cold start. Mitigation:
  the `webServer` block waits on the `:1430` URL before tests start; selectors target stable
  text/roles, not timing. Run locally on macOS (the whole point of the fakes approach).
- **`import.meta.env` typing under `tsc`.** May need `vite/client` in tsconfig `types`. Caught by
  the typecheck gate; one-line fix.
- **Demo seed drift.** `demoFiles()` round-trips through the real disk format, so a seed the loader
  would reject fails `demo-seed.test.ts` immediately rather than silently.
- **Provider default change to `[]`.** Behavior-preserving only if nothing relied on the old seed
  default - confirmed by the "no `tree=` prop" scan over `src/` + `tests/` (empty result).
- **No CI yet.** The Playwright config is CI-aware (`reuseExistingServer:!process.env.CI`) so a
  future workflow is a one-liner, but this feature does not add `.github/workflows` - E2E runs
  locally on demand via `npm run e2e`.

## Infrastructure Prerequisites

| Category              | Requirement                                                        |
| --------------------- | ------------------------------------------------------------------ |
| Environment variables | N/A                                                                |
| Registry images       | N/A                                                                |
| Cloud quotas          | N/A                                                                |
| Network reachability  | N/A (E2E hits the local Vite server + fakes; no external network)  |
| CI status             | N/A (no CI in repo; E2E is local-only this feature)                |
| External secrets      | N/A                                                                |
| Database migrations   | N/A                                                                |
| Local tooling         | `@playwright/test` installed + `npx playwright install` (browsers) |

Verification before implementation: `npx playwright install` succeeds; `npm run dev` serves on
`:1430`. Both are local dev-machine checks, confirmed during the GREEN/VERIFY phases.

## Decision Log

| Date       | Decision                                                                 | Rationale |
| ---------- | ------------------------------------------------------------------------ | --------- |
| 2026-06-23 | Playwright-on-dev-browser-against-fakes; reject native `tauri-driver` E2E | macOS ships no WebDriver for embedded WKWebView -> native E2E is Linux-CI-only + undebuggable locally; `cargo test` already covers the real Rust send/cancel boundary. |
| 2026-06-23 | Seed the dev-browser build with a demo workspace (in-memory fs + fake HTTP) | Makes `npm run dev` interactive (something for Playwright to drive) AND promotes `mockTree` from dead seed to the live demo seed, resolving the cleanup smell. |
| 2026-06-23 | Discriminate via `MODE==="development" && !isTauri()`, not `import.meta.env.DEV` | Vitest sets `DEV=true`; gating on `DEV` would seed the demo into jsdom tests and break empty-state assertions. `MODE` is `"test"` under Vitest. |
| 2026-06-23 | Partition runners by file extension (`*.e2e.ts` Playwright / `*.spec`/`*.test` Vitest) | Robust against mis-filing (the existing `bootstrap.spec.tsx` under `tests/e2e/` proved that risk); no shared-glob collision. |
