# Spec: Bootstrap - Tauri + React + TanStack Scaffold

**Version:** 0.1.0
**Created:** 2026-06-18
**PRD Reference:** docs/prd.md (TBD)
**Status:** Draft

## 1. Overview

Stand up an empty, runnable desktop application that will become a Bruno/Postman
alternative (an API client). This feature delivers **scaffold only** - no API-client
features yet. The goal is a clean, conventionally-structured project that future
features can build on without re-litigating tooling choices.

Stack:
- **Tauri 2.x** - desktop shell (Rust backend, webview frontend)
- **React 19 + TypeScript** - UI
- **Vite** - frontend build/dev server
- **TanStack Router** - routing
- **TanStack Query** - async/server state
- **TanStack Table** - data grids
- **TanStack Form** - forms
- **TanStack Hotkeys** (`@tanstack/hotkeys`, alpha) - keybindings; cross-platform `Mod` handling, scopes, sequences
- **shadcn/ui + Tailwind CSS v4** - components + styling
- **npm** - package manager

### User Story

As a developer on this project, I want a runnable Tauri + React + TanStack scaffold
with routing, query, table, form, keybindings, and a design system wired up, so that
future features start from a consistent foundation instead of boilerplate setup.

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | `npm install` succeeds from a clean checkout with no peer-dependency errors | Must |
| AC-002 | `npm start` (alias for `tauri dev`) launches a native desktop window rendering the React app | Must |
| AC-003 | TanStack Router serves at least 2 routes (`/` home, `/settings`) with a shared layout and working in-app navigation | Must |
| AC-004 | TanStack Query is provided app-wide via `QueryClientProvider`; a demo query invoking a Tauri command resolves and renders | Must |
| AC-005 | A demo TanStack Table renders static rows (e.g. request history placeholder) | Must |
| AC-006 | A demo TanStack Form renders with one validated field and submit handler | Must |
| AC-007 | A global keybinding (`Mod+K`) is registered via TanStack Hotkeys (`useHotkey`) and triggers a visible action | Must |
| AC-008 | shadcn/ui is initialized; at least one shadcn component (Button) renders styled via Tailwind | Must |
| AC-009 | `npm run build` (frontend) and `npm run tauri build` produce a bundle without errors | Should |
| AC-010 | Lint + typecheck pass: `npm run lint` and `npm run typecheck` exit 0 | Should |
| AC-011 | A Tauri command `greet(name)` exists in Rust and is callable from the frontend (proves IPC) | Should |

## 3. User Test Cases

### TC-001: App launches and renders home route

**Precondition:** Clean checkout, `npm install` done, Rust toolchain installed.
**Steps:**
1. Run `npm start` (alias for `tauri dev`).
2. Wait for the native window to open.
3. Observe the home route content.
**Expected Result:** Window opens, home page renders with a heading and a shadcn Button. No console errors.
**Screenshot Checkpoint:** tests/screenshots/bootstrap/step-01-home.png
**Maps to:** tests/e2e/bootstrap.spec.ts → "should render home route on launch"

### TC-002: Navigation between routes works

**Precondition:** App running on home route.
**Steps:**
1. Click the "Settings" nav link.
2. Observe the URL/route change and settings content.
3. Navigate back to home.
**Expected Result:** Route changes to `/settings`, settings content renders, back navigation returns to `/`.
**Screenshot Checkpoint:** tests/screenshots/bootstrap/step-02-settings.png
**Maps to:** tests/e2e/bootstrap.spec.ts → "should navigate between routes"

### TC-003: Tauri IPC demo query resolves

**Precondition:** App running.
**Steps:**
1. On home route, observe the greeting block backed by a TanStack Query that calls the `greet` Tauri command.
**Expected Result:** Greeting text from the Rust backend renders (proves IPC + Query wiring).
**Screenshot Checkpoint:** tests/screenshots/bootstrap/step-03-ipc.png
**Maps to:** tests/e2e/bootstrap.spec.ts → "should resolve a query backed by a Tauri command"

### TC-004: Global keybinding fires

**Precondition:** App running on any route.
**Steps:**
1. Press `Cmd+K` (macOS) / `Ctrl+K` (Win/Linux).
**Expected Result:** A visible action occurs (e.g. a placeholder command-palette dialog toggles).
**Screenshot Checkpoint:** tests/screenshots/bootstrap/step-04-hotkey.png
**Maps to:** tests/e2e/bootstrap.spec.ts → "should toggle command palette on hotkey"

## 4. Data Model

No domain entities in this feature. Only placeholder/demo shapes:

### DemoRow (placeholder for future request history)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | string | Yes | Row id |
| method | string | Yes | HTTP method placeholder (e.g. "GET") |
| name | string | Yes | Display name |

### Relationships

None. Real data model arrives with future features.

## 5. API Contract (Tauri IPC, not HTTP)

### Command: `greet(name: string) -> string`

**Description:** Minimal Rust command proving frontend↔backend IPC.

**Request (frontend `invoke`):**
```json
{ "name": "World" }
```

**Response:**
```json
"Hello, World! Greetings from Tauri."
```

**Error Responses:**
- IPC failure surfaces as a rejected promise → TanStack Query `error` state.

## 6. UI Behavior

### States

- **Loading:** Query demo shows a "Loading..." placeholder while the command resolves.
- **Empty:** Demo table shows an "empty" row state when given no rows.
- **Error:** Query error renders an inline error message (no crash).
- **Success:** Greeting + table + form render normally.

### Layout

- Root layout: top nav (Home, Settings) + content outlet.
- Command palette: hidden dialog toggled by global hotkey.

### Screenshot Checkpoints

| Step | Description | Path |
|------|-------------|------|
| 1 | Home route on launch | tests/screenshots/bootstrap/step-01-home.png |
| 2 | Settings route | tests/screenshots/bootstrap/step-02-settings.png |
| 3 | IPC-backed greeting | tests/screenshots/bootstrap/step-03-ipc.png |
| 4 | Command palette via hotkey | tests/screenshots/bootstrap/step-04-hotkey.png |

## 7. Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| Rust toolchain missing | `npm start` fails fast with a clear message (documented in README) |
| Unknown route navigated | Router renders a 404 / not-found route |
| `greet` command rejects | Query enters error state, inline message shown, app stays alive |

## 8. Dependencies

- Node.js (version pinned via `.nvmrc`)
- Rust stable toolchain + platform Tauri prerequisites (per Tauri 2 docs)
- npm (no yarn - this repo is outside ~/projects/as24/)

## 9. Infrastructure Prerequisites

| Category | Requirement |
|----------|-------------|
| Environment variables | N/A |
| Registry images | N/A |
| Cloud quotas | N/A |
| Network reachability | npm registry reachable for install |
| CI status | N/A (CI added in a later feature) |
| External secrets | N/A |
| Database migrations | N/A |

**Verification before implementation:** Confirm Rust toolchain (`rustc --version`), Node via `nvm use`, and Tauri OS prerequisites are installed before running `tauri dev`.

## 10. Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-06-18 | 0.1.0 | Piotr Zieliński | Initial scaffold spec |
