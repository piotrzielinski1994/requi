# Plan: Layout - MVP Workspace Shell

**Spec:** docs/features/20260618223203-layout/spec.md
**Created:** 2026-06-18
**Estimated Effort:** ~1-1.5 days
**Status:** Draft

## 1. Overview

Build the workspace shell with mock data and UI-local state only. Approach B:
context-driven compound components - one `WorkspaceProvider` owns all UI state; panels
read it via a `useWorkspace()` hook (no prop drilling). Replace the bootstrap home page;
remove demos, top nav, and command palette. Resizable splits via shadcn `resizable`.

## 2. Task Breakdown

| # | Task | Spec Ref | Files | Type | Estimate |
|---|------|----------|-------|------|----------|
| 1 | Add shadcn components: resizable, tabs, input, select, scroll-area, badge | deps, AC-013 | `src/components/ui/*`, `package.json` | impl | 0.5h |
| 2 | Mock data module: ADT tree + auth union + console lines, seeded to approved layout | AC-003, data model | `src/components/workspace/mock-data.ts` | impl | 1h |
| 3 | WorkspaceContext + provider + `useWorkspace` hook (state + actions, immutable updates) | AC-014, behavior notes | `src/components/workspace/workspace-context.tsx` | impl | 1.5h |
| 4 | SidebarTree + recursive TreeRow (folders expand/collapse, request leaf badge, selection) | AC-003, AC-004, AC-005, AC-006 | `src/components/workspace/{sidebar,sidebar-tree,tree-row}.tsx` | impl | 1.5h |
| 5 | ContentHeader (open-request tabs + close + `+`) | AC-007 | `src/components/workspace/content-header.tsx` | impl | 1h |
| 6 | UrlBar (method select + url input + inert Send) | AC-008 | `src/components/workspace/url-bar.tsx` | impl | 0.5h |
| 7 | RequestPane (Params/Headers/Auth/Scripts tabs; auth union switch) | AC-009, AC-011 | `src/components/workspace/request-pane.tsx` | impl | 1h |
| 8 | ResponsePane (Response/Headers tabs + status readout) | AC-010 | `src/components/workspace/response-pane.tsx` | impl | 0.5h |
| 9 | Console strip (mock log lines) | AC-012 | `src/components/workspace/console.tsx` | impl | 0.5h |
| 10 | Compose Content + Main + WorkspaceLayout (resizable groups) | AC-002, AC-013 | `src/components/workspace/{content,main,workspace-layout}.tsx` | impl | 1h |
| 11 | Mount at home route; remove demos, top nav, command palette | AC-001, AC-015 | `src/routes/{index,__root}.tsx`, delete `demo-*.tsx`, `command-palette.tsx` | impl | 0.5h |
| 12 | Behavior tests (Vitest + RTL) per TC-002..TC-005 + auth variants | AC-016, TC-002..005 | `src/components/workspace/__tests__/*.test.tsx` | test | 2h |
| 13 | Docs drift check: README repo-layout + commands; CLAUDE.md if convention added | - | `README.md` | impl | 0.5h |

## 3. Execution Order

```mermaid
graph TD
    T1[shadcn components] --> T4[Sidebar+Tree]
    T1 --> T5[ContentHeader]
    T1 --> T6[UrlBar]
    T1 --> T7[RequestPane]
    T1 --> T8[ResponsePane]
    T2[mock-data] --> T3[WorkspaceContext]
    T3 --> T4
    T3 --> T5
    T3 --> T6
    T3 --> T7
    T3 --> T8
    T3 --> T9[Console]
    T4 --> T10[Compose layout]
    T5 --> T10
    T6 --> T10
    T7 --> T10
    T8 --> T10
    T9 --> T10
    T10 --> T11[Mount + remove demos]
    T11 --> T12[Behavior tests]
    T12 --> T13[Docs drift]
```

T2 (mock-data) and T3 (context) are the spine - they unblock every panel. Panels
(T4-T9) parallelize once the context exists.

## 4. TDD Strategy

Per CLAUDE.md TDD: red-green-refactor on behavior. Panels have real interaction
(toggle, select, tab-switch) so they get failing tests first. Pure-presentational bits
(Console, inert Send) get a presence test only.

### RED Phase
- For each behavioral panel, write the failing test before the component:
  - TreeRow: expand reveals children / collapse hides; request leaf shows method badge.
  - Sidebar selection: request leaf click highlights + opens tab; folder click selects, no tab.
  - ContentHeader: tab click focuses; `x` removes; closing active moves active or nulls.
  - RequestPane: active sub-tab swaps panel; auth bearer renders token field (one per variant).
  - ResponsePane: Response/Headers tab swap; status readout present.
  - UrlBar: renders active request method + url (presence).
- Tests render a component wrapped in `WorkspaceProvider` seeded with a small mock tree.

### GREEN Phase
- Implement each panel until its test passes; wire actions through `useWorkspace()`.

### REFACTOR Phase
- Extract shared bits (e.g. method-badge, key-value table) once duplicated across panels.
- Tighten the context API surface; keep state immutable.

## 5. File Changes

### New Files (all under `src/components/workspace/`)
- `mock-data.ts` - ADT tree, auth union, console lines + seed data
- `workspace-context.tsx` - context, `WorkspaceProvider`, `useWorkspace`
- `sidebar.tsx`, `sidebar-tree.tsx`, `tree-row.tsx` - sidebar + recursive tree
- `content-header.tsx`, `url-bar.tsx` - content top rows
- `request-pane.tsx`, `response-pane.tsx` - the two panes
- `console.tsx` - console strip
- `content.tsx`, `main.tsx`, `workspace-layout.tsx` - composition + resizable shell
- `__tests__/*.test.tsx` - behavior tests
- `src/components/ui/{resizable,tabs,input,select,scroll-area,badge}.tsx` - shadcn (generated)

### Modified Files
- `src/routes/index.tsx` - render `WorkspaceLayout` instead of the demo page
- `src/routes/__root.tsx` - drop top nav + `CommandPalette`; layout owns full window
- `README.md` - update repo-layout sketch (new `components/workspace/`), drop demo refs

### Deleted Files
- `src/components/demo-table.tsx`, `src/components/demo-form.tsx`, `src/components/command-palette.tsx`
- their tests, if any

## 6. Dependencies

### Must Complete First
- Task 1 (shadcn primitives) blocks panels that use them.
- Tasks 2 + 3 (mock-data, context) block every panel.

### Can Parallelize
- Panels T4-T9 are independent once T1 + T3 land.

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `react-resizable-panels` nested groups (horizontal in vertical) layout quirks | Panes mis-size | Follow shadcn resizable docs via context7; test nesting early in T10 |
| Tree component / `TreeNode` type name clash | Confusion | Component named `TreeRow`; type stays `TreeNode` (per spec) |
| Removing command-palette leaves dangling `Mod+K` hotkey wiring | Build/lint error | Grep for hotkey + palette refs in `__root.tsx`/`router.tsx`; remove together in T11 |
| Deleting `/settings` link strands the route | Dead route | Keep route file; only remove the nav link (spec E-6) |
| Sub-tab state global vs per-request surprises later | Rework when editing lands | Documented MVP decision; revisit when real actions added |

## 8. Acceptance Verification

| AC ID | Criterion | Test(s) | Status |
|-------|-----------|---------|--------|
| AC-001 | Layout at home route | TC-001 (manual/render) | Pending |
| AC-002 | Full-window sidebar+content+console | TC-001 | Pending |
| AC-003 | Tree with 3-deep nesting | tree render test | Pending |
| AC-004 | Folder expand/collapse | TC-002 | Pending |
| AC-005 | Request click selects + opens tab | TC-003 | Pending |
| AC-006 | Folder click selects, no tab | sidebar selection test | Pending |
| AC-007 | Content-header tabs + close + `+` | TC-005 | Pending |
| AC-008 | URL bar method+url+inert Send | UrlBar test | Pending |
| AC-009 | Request sub-tabs render panels | TC-004 | Pending |
| AC-010 | Response sub-tabs + status | response-pane test | Pending |
| AC-011 | Auth variants render | auth-panel tests (none/bearer/basic) | Pending |
| AC-012 | Console strip | console render test | Pending |
| AC-013 | Resizable splits | manual/smoke | Pending |
| AC-014 | Shared UI state, no prop drilling | context-driven (arch) | Pending |
| AC-015 | Demos + nav + palette removed | grep + render test | Pending |
| AC-016 | lint + typecheck + test pass | manual | Pending |
