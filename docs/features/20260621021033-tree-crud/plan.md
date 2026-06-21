# Plan: Tree CRUD

Implements [spec.md](spec.md). TDD, red-green-refactor. Frontend tests: Vitest (`npm test`).

## Approach

Four layers, pure -> stateful -> wired -> surfaced, each mirroring an existing seam so the
blast radius stays small:

1. **Pure tree ops (`src/lib/workspace/tree-edit.ts`, new).** Lift `findNode` / `containsId` /
   `insertNode` / `removeNode` out of `move.ts` (they are already there, just not exported) into
   `tree-edit.ts`, and add `renameNode`, `duplicateRequest`, `collectRequestIds`,
   `countDescendants`. `move.ts` imports the lifted helpers (one source of truth, no dup).
   Every fn pure, returns a new tree, no mutation - same style as `updateRequest` /
   `updateNodeConfig`. Unit-tested without DOM.

2. **Provider state + actions (`WorkspaceProvider`).** Add `renamingNodeId` + `pendingDelete`
   state and the actions: `beginRename`/`commitRename`/`cancelRename`, `newFolder`,
   `duplicateRequest`, `requestDeleteNode`/`confirmPendingDelete`/`cancelPendingDelete`,
   `newRequest(target?)` placement, and the **draft-save = create** branch in the existing
   draft path. All persistence reuses the existing local `persistTree(next, label)` (toast /
   `failed to persist <label>` console line) - the same code path config/edits/move/duplicate
   share. Fresh ids from a `nodeCounter` ref -> `new-<n>` (never `draft-`).

3. **Surface primitives.** `src/components/ui/context-menu.tsx` (new) - thin shadcn-style
   wrapper over `radix-ui`'s `ContextMenu` (no new dep), no rounded corners. Inline-rename
   `<input>` rendered by `TreeRow`.

4. **Wiring.** `registry.ts` gains the four actions; `Main` adds their handlers (target =
   `selectedNodeId`, request-only ops fall back to `activeRequestId`) + the `delete-node`
   editable-focus guard; `DeleteConfirmDialog` mounted in `Main`. The palette list already
   derives from `SHORTCUT_ACTIONS` x `handlers`, so the four show up with zero extra code.

Why this shape: the create-request flow is deliberately "draft + save writes the file" (user
decision) so it reuses feature #1's draft tab + `saveActiveRequest` precedence wholesale - the
only new thing is the branch that inserts a draft into the tree instead of no-opping. Folder
create / duplicate / delete are direct tree writes through the same `persistTree` seam as
drag-move. Selection-relative placement reuses `MoveTarget` + the existing `locateNode`, so
"insert" is the same vocabulary the move feature already speaks.

## Files

### New

| File | Purpose |
|------|---------|
| `src/lib/workspace/tree-edit.ts` | Lifted `findNode`/`containsId`/`insertNode`/`removeNode` + new `renameNode`/`duplicateRequest`/`collectRequestIds`/`countDescendants` |
| `src/lib/workspace/__tests__/tree-edit.test.ts` | Unit: rename (incl. blank no-op + folder), duplicate (after original, deep copy, folder no-op), collect/count, insert/remove round-trips |
| `src/components/ui/context-menu.tsx` | shadcn-style `ContextMenu` wrapper over `radix-ui` (no rounded corners) |
| `src/components/workspace/delete-confirm-dialog.tsx` | Confirm dialog for a non-empty folder delete (reads `pendingDelete`) |
| `src/components/workspace/__tests__/tree-crud-context.test.tsx` | Behavior: create-request-save-inserts, placement, new-folder+rename, rename commit/cancel/blank, delete request/empty/non-empty, duplicate, persist-failure - driven through a probe like `persist-edits-context.test.tsx` |
| `src/components/workspace/__tests__/tree-row-crud.test.tsx` | Render contract: context-menu items per kind, inline-rename input appears + commits on Enter, double-click begins rename |
| `src/components/workspace/__tests__/tree-crud-shortcuts.test.tsx` | Shortcut/palette handlers act on selection, no-op without target, `delete-node` input guard |
| `src/lib/workspace/request-name.ts` | `deriveRequestName(url)` - URL path -> request name (v0.2.0 auto-name) |
| `src/lib/workspace/__tests__/request-name.test.ts` | Unit: prefix/scheme/query/hash stripping, `:param` keep, empty fallback |
| `src/components/workspace/__tests__/request-autoname-context.test.tsx` | Behavior: new request auto-names from URL until renamed/saved; saved request never auto-renames |

### Modified

| File | Change |
|------|--------|
| `src/lib/workspace/move.ts` | Import `findNode`/`containsId`/`insertNode`/`removeNode` from `tree-edit.ts`; drop the local copies |
| `src/components/workspace/workspace-context.tsx` | New state + actions (§Approach 2); extend `newRequest`/draft-save; add to context value + memo deps |
| `src/components/workspace/tree-row.tsx` | Wrap row in `ContextMenu`; inline-rename input; double-click -> `beginRename` |
| `src/lib/shortcuts/registry.ts` | Add `new-folder` (`Mod+Shift+N`), `duplicate-request` (`Mod+D`), `rename-node` (`F2`), `delete-node` (`Mod+Backspace`) |
| `src/components/workspace/main.tsx` | Handlers for the four (target from selection/active); `delete-node` editable-focus guard; mount `DeleteConfirmDialog` |
| `src/components/settings/__tests__/shortcuts-section*.test.tsx` | Action count / free-combo example updates if the new defaults collide with a test's "free" combo (grep first per learnings) |
| `README.md` | Note tree is now writable (create/rename/delete/duplicate) + the new shortcuts |
| `docs/learnings.md` | Any gotcha hit (radix ContextMenu under jsdom, draft-id swap, F2/Mod+Backspace) |
| `docs/adr.md` | Rows: draft-save-creates-file model; context-menu+palette+shortcuts surface; selection-relative placement |
| `.pzielinski/todos.md` | Mark feature #2 tree-crud DONE with the shipped summary |

## Edge cases handled (from spec §6)

- No `onTreeChange` (dev) -> create/rename/delete fold in-memory + toast "Saved"; tab-id swap
  still happens. (`persistTree` already handles the absent-callback branch.)
- Collapsed target folder -> auto-expand on create.
- Slug collision on rename -> `serialize`'s `uniqueSlug` disambiguates; no name-uniqueness rule.
- Blank/whitespace rename -> `renameNode` + `commitRename` no-op, keep old name, no write.
- Delete active request / its ancestor folder -> close affected tabs, `activeRequestId` falls
  back like a normal close (reuse `closeRequest` per id from `collectRequestIds`).
- Delete mid-rename -> clear `renamingNodeId`.
- Duplicate reflects the saved tree node, not a session override (operates on `tree`).
- `delete-node` while an input/CodeMirror is focused -> handler no-ops (guard on
  `document.activeElement`), so `Mod+Backspace` keeps its text-editing meaning.
- Empty workspace -> create targets root; other ops no-op (no target).

## Execution order (TDD)

Phase 3 spawns a fresh test-writer (RED), then GREEN/REFACTOR here.

1. **Pure ops** (AC-004 logic, AC-007 logic)
   - RED: `tree-edit.test.ts` - rename (request/folder/blank-noop/missing), duplicate (after,
     deep, distinct id+name, folder no-op), collectRequestIds, countDescendants, insert/remove
     parity with the old `move.ts` behavior.
   - GREEN: `tree-edit.ts` + repoint `move.ts` imports.
2. **Provider actions** (AC-001..AC-003, AC-005..AC-007, AC-010)
   - RED: `tree-crud-context.test.tsx` via a probe - draft-save inserts + swaps id + persists;
     placement (inside folder / sibling / root); new-folder inserts+expands+selects+renames;
     rename commit/cancel/blank; delete request/empty-folder immediate; delete non-empty sets
     `pendingDelete` then confirm removes + closes tabs; duplicate inserts after + activates;
     persist-failure console line.
   - GREEN: extend `workspace-context.tsx`.
3. **Surface primitives + TreeRow** (AC-004 UI, AC-008)
   - RED: `tree-row-crud.test.tsx` - context-menu items per node kind; inline-rename input
     appears when `renamingNodeId===id`, commits on Enter, cancels on Esc; double-click begins.
   - GREEN: `context-menu.tsx` + `tree-row.tsx`.
4. **Registry + wiring + palette** (AC-009)
   - RED: `tree-crud-shortcuts.test.tsx` - the four handlers act on selection; no-op without
     target; `delete-node` guarded when an input is focused; palette lists them.
   - GREEN: `registry.ts` + `main.tsx` + `DeleteConfirmDialog`.
5. **Docs**: README, learnings, ADR, todos.

One commit per AC group: `feat(tree-crud): AC-NNN <desc>`.

## Tests to write (>= one per AC)

| AC | Test | Layer |
|----|------|-------|
| AC-001 | draft-save inserts request into tree + swaps tab id + round-trip reproduces it | context + tree-edit |
| AC-002 | placement inside folder / sibling of request / root | context |
| AC-003 | new-folder inserts + expands + selects + enters rename + round-trip | context + tree-row |
| AC-004 | rename commit writes; Esc cancels; blank rejected; folder rename rewrites descendant paths | context + tree-edit + tree-row |
| AC-005 | delete request + empty folder remove immediately (no dialog), close tab | context |
| AC-006 | delete non-empty folder opens dialog; confirm removes + closes tabs; cancel no-ops | context + dialog render |
| AC-007 | duplicate inserts "<name> copy" after original, activates it; folder no-op | context + tree-edit |
| AC-008 | context menu shows kind-appropriate items | tree-row |
| AC-009 | four actions in registry w/ defaults; handlers act on selection; delete input-guard; palette lists | shortcuts + registry |
| AC-010 | persist failure keeps change + logs; no-callback toasts Saved | context |
| AC-011 | lint/typecheck/test/cargo green | verifier (Phase 4) |

## Risks

- **radix `ContextMenu` under jsdom**: portal items may not mount on a synthetic right-click
  (same class of issue as `Select`/dnd per learnings). Mitigation: test the menu's render
  contract by mounting the menu content directly / asserting trigger wiring, not a real
  right-click portal open - and keep the action logic in provider handlers that are unit-tested
  without the menu.
- **`Mod+Backspace` eaten by Karabiner/OS or hijacking text edit**: editable-focus guard covers
  the in-app text case; if Karabiner eats it on the physical keyboard the action still works via
  context-menu + palette (key is rebindable). Flagged, accepted - consistent with the keyboard
  ADR.
- **Draft-id swap races tab state**: swapping the open-tab id, active id, selection, and
  response-state map must happen atomically with the insert. Mitigation: do it in one functional
  state update batch in the save branch; cover with the round-trip + "tab still open under new
  id" assertion.
- **`F2` / new defaults collide with a test's "free" combo**: grep the suite before picking
  (learnings: adding an action broke free-combo examples once). `F2`/`Mod+D`/`Mod+Shift+N`/
  `Mod+Backspace` are currently unused - verified against `registry.ts`.

## Verification

Phase 4 fresh verifier runs `npm run lint` + `npm run typecheck` + `npm test` + `cargo test`,
reads each test body against its AC, and probes the delete-confirm / blank-rename / input-guard
/ placement / persist-failure edges. Coverage threshold: **none** enforced (no threshold in
`vitest.config.ts` / `package.json`).

## Completion

Status: **DONE**. Gates: typecheck clean, lint 0 errors (7 pre-existing accepted
warnings), 682 frontend tests pass, cargo tests pass. Two fresh-context verifier passes:
first confirmed all 11 ACs + flagged two test-quality gaps (AC-010 no-callback branch
untested; delete-shortcut assertion loose due to a duplicate fixture id); second confirmed
both gaps closed with no regression.

### AC -> test traceability

| AC | Proving test(s) |
|----|-----------------|
| AC-001 | `tree-crud-context.test.tsx` "should insert a saved draft into the selected folder and persist a round-trippable tree" + "should swap the draft tab id to a non-draft id and keep the tab open"; `persist-edits-context.test.tsx` "should mark an edited draft dirty and persist it on save (create)" |
| AC-002 | `tree-crud-context.test.tsx` "should append the saved draft at workspace root if nothing is selected" + "should place the saved draft in the explicit target folder" |
| AC-003 | `tree-crud-context.test.tsx` "should insert a folder inside the target, expand+select it, and begin rename" + "should persist the new folder under the committed name (round-trip)" |
| AC-004 | `tree-edit.test.ts` `renameNode` block; `tree-crud-context.test.tsx` rename block (commit/cancel/blank/folder); `tree-row-crud.test.tsx` inline-rename block |
| AC-005 | `tree-crud-context.test.tsx` "should remove a request immediately..." + "should remove an empty folder immediately..." |
| AC-006 | `tree-crud-context.test.tsx` "should set pendingDelete then remove the folder and descendants on confirm" + "...cancelled" |
| AC-007 | `tree-edit.test.ts` `duplicateRequest` block; `tree-crud-context.test.tsx` duplicate block (+ folder no-op) |
| AC-008 | `tree-row-crud.test.tsx` "should show all five items including Duplicate for a request row" + "...minus Duplicate for a folder row" |
| AC-009 | `tree-crud-shortcuts.test.tsx` registry block (4 defaults/names/resolve/conflict) + Main wiring (duplicate on selection, no-op without, delete on selection, input-focus guard) |
| AC-010 | `tree-crud-context.test.tsx` "should keep the change and append a failed-to-persist console line if the write fails" + "should fold the change into the in-memory tree if there is no onTreeChange" |
| AC-011 | lint/typecheck/`npm test`/`cargo test` all exit 0 |

### Decisions / deviations during implementation

| Date | Decision | Rationale |
| ---- | -------- | --------- |
| 2026-06-21 | `tree-edit.ts` is the new home for `findNode`/`containsId`/`insertNode`/`removeNode`; `move.ts` imports them | They already lived in `move.ts` (unexported); the new ops need them too. One source of truth, no dup |
| 2026-06-21 | `removeNode` strips ALL nodes matching an id; `duplicateRequest` copies only the FIRST match | Real path-based ids are unique, so multi-match never happens in production; the test fixture reuses `req-profile` so the delete-shortcut test was retargeted to the unique `req-session` |
| 2026-06-21 | Created nodes get a synthetic `new-<n>` id (not `draft-`) | A `draft-` id is treated as an unsaved draft + stripped from persisted open-tabs; created nodes must persist + not re-trigger the draft path. On next disk reload the synthetic id is replaced by a path-based id (same accepted limitation a drag-move has) |
| 2026-06-21 | `delete-node` handler no-ops when an INPUT/TEXTAREA/contentEditable is focused | `Mod+Backspace` is a common delete-to-line-start text gesture; the guard keeps it usable for text editing and prevents a stray node delete from the URL bar / body / config editors |
| 2026-06-21 | Create actions (New request/folder): FOLDER row (create inside) + empty-area menu (create at root), NOT request rows (user feedback, 2 rounds) | "New request on a leaf request row" is meaningless. Folder rows create inside themselves; request rows are Rename/Duplicate/Delete only; empty-area menu creates at root. All also in palette + shortcuts (selection-relative) |
| 2026-06-21 | Empty-area `ContextMenuTrigger asChild` wraps a `flex-1` div (ScrollArea inside it), not the ScrollArea directly | ScrollArea is a non-forwardRef function component (ref swallowed -> trigger never armed) and its viewport content sizes to content height (`min-h-full` on an inner div leaves blank space outside the trigger) - both produced the native WebView menu instead of ours. A flex-1 div fills the sidebar via the flex chain and forwards the ref |
| 2026-06-21 | New request = create immediately like new folder; DRAFT SYSTEM removed entirely (user feedback, supersedes the draft-save model) | User: a new request must appear in the sidebar instantly + focus its rename, like new folder - not live as an unsaved draft. To be in the tree it must be a real node, so drafts lost their purpose. `newRequest` now inserts a `new-<n>` node, persists, opens+selects its tab, begins rename. Removed: `drafts` state, `draftCounter`/`draftTargets`, `PRISTINE_DRAFT`, `createFromDraft`, all draft branches in `requestsById`/`dirtyRequestIds`/`closeRequest`/`closeAllRequests`/`saveActiveRequest`. ~8 test files updated off the draft model. Net simplification |
| 2026-06-21 | Inline `RenameInput` ignores the radix menu-close teardown blur (refocus until a 0ms `readyRef` settle, re-asserting focus) | A create fired from a `ContextMenu` item opens the rename input as the menu closes; the menu's FocusScope teardown blurred the fresh input (committing the default name) and moved focus to body. The settle-gate + re-focus makes the input win the race and keeps it focused/selected so the name is immediately typable |
| 2026-06-21 | New request focuses the URL input (not inline rename) and auto-names from the URL path until renamed/saved (user directive) | A request is identified by its URL, so the fast path is "type the URL, name follows". `newRequest` bumps a `focusUrlNonce` the `UrlBar` watches + tracks the id in an `autoNameIds` ref; `setRequestUrl` derives the name (`deriveRequestName`, new pure module) while auto-named. Name is a session override (folded on save) so no extra writes per keystroke. Auto-naming ends on rename/save; an already-saved request never auto-renames. New FOLDERS keep focusing inline rename (a folder has no URL) |
