# Spec: Layout - MVP Workspace Shell

**Version:** 0.1.0
**Created:** 2026-06-18
**Status:** Draft

## 1. Overview

Deliver the MVP visual shell of the API client: a resizable, multi-pane workspace with
mock data and **no real behavior** (no HTTP, no persistence, no Send wiring). The goal
is to validate the layout and the component/state architecture before any networking or
file features land.

What this feature delivers:
- A full-window workspace layout that replaces the current home route.
- A collapsible sidebar tree (folders, nested subfolders, request leaves).
- A content area with request tabs, a URL bar, and side-by-side request/response panes.
- A console strip at the bottom of the content area.
- Resizable splits between sidebar/content, content/console, and request/response.
- UI-local interactivity only: expand/collapse, tab switching, request selection.

What this feature does **not** deliver:
- No HTTP requests. The Send button is inert; responses are pre-baked mock data.
- No persistence (no file storage, no Tauri IPC for collections).
- No editing of request data (URL, params, headers render read-only from mock data).
- No real command palette / nav (both removed - see edge cases).

### User Story

As a developer building this API client, I want the full workspace layout standing with
mock data and local UI state, so that the structure and component architecture are
validated and future features (HTTP, persistence, editing) have a shell to plug into.

### Approved layout (ASCII)

Overall - sidebar spans full height on the left; the right side stacks content over
console:

```
+----------+--------------------------------------------------+
|          |  content                                         |
| sidebar  |                                                  |
|          +--------------------------------------------------+
|          |  console                                         |
+----------+--------------------------------------------------+
```

Content area (right, top) - content-header spans both columns; a full-width URL bar
sits below it; then request/response columns each with their own header:

```
+----------------------------------------------------------------+
| content-header   (open-request tabs)                      [+]  |
+----------------------------------------------------------------+
| [POST v]  https://api.example.com/oauth/token        [ Send ]  |   <- url-bar (full width)
+-------------------------------+--------------------------------+
| request-header                | response-header                |
| Params Headers Auth Scripts   | Response Headers      200 142ms|
+-------------------------------+--------------------------------+
|                               |                                |
|  request body (mock)          |  response body (mock)          |
|                               |                                |
+-------------------------------+--------------------------------+
```

Sidebar tree - folders nest arbitrarily deep; requests are leaves with a method badge;
folders expand (`v`) / collapse (`>`):

```
v  Auth
   v  OAuth
      v  Tokens
         POST  token        <- request nested 3 folders deep
         GET   refresh
      GET   userinfo
>  Users                    <- collapsed folder
v  Billing
   GET   invoices
   POST  charge
GET   health                <- request leaf at root
```

## 2. Acceptance Criteria

| ID | Criterion | Priority |
|----|-----------|----------|
| AC-001 | The workspace layout renders at the home route (`/`), replacing the bootstrap demo page | Must |
| AC-002 | The layout fills the full window: sidebar (full height) on the left, content over console on the right | Must |
| AC-003 | The sidebar renders a tree from mock data with folders, nested subfolders, and request leaves; at least one request is nested 3 folders deep | Must |
| AC-004 | Folders expand/collapse on click (`v` open, `>` collapsed); state is UI-local | Must |
| AC-005 | Clicking a request leaf highlights it (selection) and opens/focuses its tab in the content-header | Must |
| AC-006 | Clicking a folder selects/toggles it but opens no request tab | Must |
| AC-007 | Content-header shows open-request tabs with a close (`x`) affordance and a `+` placeholder; clicking a tab focuses it; clicking `x` removes it | Must |
| AC-008 | A full-width URL bar renders between the content-header and the request/response headers, showing the active request's method (select) + URL (input) + an inert Send button | Must |
| AC-009 | Request pane has tabs Params / Headers / Auth / Scripts; the active tab's mock panel renders | Must |
| AC-010 | Response pane has tabs Response / Headers plus a status readout (e.g. `200 · 142ms`); the active tab's mock panel renders | Must |
| AC-011 | Auth panel renders per discriminated-union variant (none / bearer / basic) | Must |
| AC-012 | A console strip renders at the bottom of the content area with mock log lines | Must |
| AC-013 | Splits are resizable via drag handles: sidebar\|content, content\|console, request\|response | Must |
| AC-014 | All UI state (expanded folders, selection, open tabs, active request, active sub-tabs) is shared across panels without prop drilling | Must |
| AC-015 | The bootstrap demo components (demo-table, demo-form, greeting) and the top nav + command palette are removed | Must |
| AC-016 | `npm run lint`, `npm run typecheck`, and `npm test` exit 0 | Must |

## 3. User Test Cases

### TC-001: Workspace renders on launch

**Precondition:** App built, home route loaded.
**Steps:**
1. Launch the app (or load `/` in `npm run dev`).
2. Observe the window.
**Expected Result:** Sidebar (left, full height) with a folder tree; content area top-right with request tabs, URL bar, request/response panes; console strip bottom-right. No bootstrap demo content, no top nav.
**Maps to:** workspace render test.

### TC-002: Expand and collapse a folder

**Steps:**
1. Click a collapsed folder (`>`).
2. Click it again.
**Expected Result:** First click reveals its children and the marker flips to `v`; second click hides them and flips back to `>`.
**Maps to:** TreeRow expand/collapse tests.

### TC-003: Select a deeply nested request

**Steps:**
1. Expand Auth -> OAuth -> Tokens.
2. Click `POST token`.
**Expected Result:** The row is highlighted (selected) and a `POST token` tab is focused in the content-header; the URL bar shows the request's method + URL.
**Maps to:** sidebar selection + UrlBar tests.

### TC-004: Switch request sub-tabs

**Steps:**
1. With a request active, click the Headers tab in the request pane.
2. Click the Auth tab.
**Expected Result:** Headers panel shows, then the Auth panel shows the variant-specific fields.
**Maps to:** request sub-tab + auth panel tests.

### TC-005: Close a request tab

**Steps:**
1. Open two requests.
2. Click `x` on one tab.
**Expected Result:** That tab is removed from the content-header; the other remains.
**Maps to:** ContentHeader tab tests.

### TC-006: Resize a split

**Steps:**
1. Drag the handle between sidebar and content.
**Expected Result:** The sidebar width changes; content reflows.
**Maps to:** manual / smoke (resizable behavior owned by the shadcn primitive).

## 4. Data Model

Mock data lives in one module (`mock-data.ts`). The tree is a discriminated union (ADT)
keyed on `kind`; auth is a discriminated union keyed on `type`.

```ts
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type KeyValue = { key: string; value: string };

type Auth =
  | { type: "none" }
  | { type: "bearer"; token: string }
  | { type: "basic"; username: string; password: string };

type RequestResponse = {
  status: number;
  timeMs: number;
  sizeBytes: number;
  body: string;            // pretty-printed JSON string
  headers: KeyValue[];
};

type RequestNode = {
  kind: "request";
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  auth: Auth;
  scripts: { pre: string; post: string };
  response: RequestResponse;
};

type FolderNode = {
  kind: "folder";
  id: string;
  name: string;
  children: TreeNode[];    // folders or requests, recursive
};

type TreeNode = FolderNode | RequestNode;

const mockTree: TreeNode[];           // seeds the approved sidebar tree
const mockConsoleLines: string[];     // seeds the console strip
```

The tree is driven by mock data only - no editing, no persistence.

### UI state (behavior, not shape)

The workspace tracks, as local UI state: which folders are expanded, which tree node is
selected (highlighted), which requests are open as tabs, which tab is active, and which
sub-tab is active in each of the request and response panes. The exact state container
and setter API are an implementation concern (see plan.md).

Behavior decisions that constrain that state:
- **Selection vs active tab are distinct.** The selected tree node (highlight) and the
  active request tab coincide only when the last action was selecting a request leaf in
  the tree; otherwise they move independently (selecting a folder, clicking another tab).
- **Sub-tab state is global, not per-request,** for MVP simplicity. Switching the active
  request keeps the same active sub-tab.
- **Initial state** is seeded from mock data: root folders expanded, first request open
  and selected.

## 5. UI Behavior

- **Styling:** native shadcn/ui (New York, neutral base) + Tailwind v4 theme tokens
  (`bg-background`, `border`, `bg-muted`, etc.). Light/dark aware. The brainstorm
  wireframe colors were throwaway and are NOT the target look.
- **Inert affordances:** Send button, URL input, and request/response bodies are
  read-only renders of the active request's mock data. They have no behavior beyond
  presence; bodies/URL derive from the active request.
- **Empty state:** when no request is active (all tabs closed, or a folder is selected),
  the URL bar and panes render a neutral empty/placeholder state.
- **Method badge:** requests show a small method badge (GET/POST/...) in the tree and in
  the URL bar method select.

## 6. Edge Cases

| # | Case | Handling |
|---|------|----------|
| E-1 | All request tabs closed | No active request; panes + URL bar show empty state |
| E-2 | Folder selected (not a request) | Folder highlighted; active request unchanged; no tab opens |
| E-3 | Re-selecting an already-open request | Focus its existing tab; do not duplicate |
| E-4 | Closing the active tab | Active moves to an adjacent open tab, or null if none remain |
| E-5 | Deeply nested tree | Indentation scales per depth; no max-depth assumption |
| E-6 | Settings route unreachable | Top nav removed; `/settings` route still exists but has no in-UI link (acceptable for MVP) |

## 7. Dependencies

New shadcn/ui components to add (via the shadcn CLI): `resizable` (pulls
`react-resizable-panels`), `tabs`, `input`, `select`, `scroll-area`, `badge`. Existing
`button` reused. The sidebar tree has no shadcn primitive - it is a custom recursive
component.

Removed: bootstrap demo components (`demo-table.tsx`, `demo-form.tsx` + their tests),
the top nav in `__root.tsx`, and the command palette (`command-palette.tsx`).

## 8. Out of Scope

- Real HTTP requests / Send behavior.
- Persistence (file storage, Tauri IPC for collections, saving edits).
- Editing request data (URL, params, headers, auth, scripts are read-only).
- Drag-to-reorder tree, context menus, search/filter in the sidebar.
- Keyboard navigation of the tree/tabs (beyond what shadcn primitives provide).

## 9. Revision History

| Version | Date | Change |
|---------|------|--------|
| 0.1.0 | 2026-06-18 | Initial draft from brainstorming |
