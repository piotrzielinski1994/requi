# Plan: Explicit Save for Structured Config Panels

Implements [spec.md](spec.md). TDD, red-green-refactor. Coverage threshold: none.

## Approach

Re-target the five structured panels (Vars/Auth/Headers/Params/Script) from "persist on blur"
to "edit a draft". Requests reuse the existing `requestOverrides` draft map (add `config` to
it); folders reuse the existing `activeEditor` registration seam (the same one the folder
raw-JSON editor uses). Everything downstream - dirty dot, Cmd+S, close-confirm - already exists
and keys off those two seams, so this is mostly wiring + one deep-equal compare.

### Request panels

- `RequestOverride` += `config`. New provider fn `setRequestConfig(id, config)` -> `mergeOverride(id, {config})`.
- Panels become **controlled**: take `onChange(config)` instead of calling `saveNodeConfig`.
  In the request pane, `onChange` -> `setRequestConfig`. Since `request-pane` already passes
  the override-merged `request.config` (from `requestsById`), the panel re-renders with the
  draft value.
- `dirtyRequestIds`: the existing per-field `override[field] !== base[field]` compare is a
  reference check - wrong for the `config` object. Add a deep-equal for the `config` field
  (small `deepEqual` helper or `JSON.stringify` compare on the config slice).
- Cmd+S: `saveActiveRequest` already folds `config` via `RequestPatch` -> persists + toast +
  clears the override. No change needed there.

### Folder panels

- FolderPane holds a local `draftConfig` (seeded from the node, re-seeded on node switch).
  Panels' `onChange` updates the draft. FolderPane registers an `activeEditor` with
  `isDirty` (deep-equal draft vs node.config), `canSave: true`, `save()` -> `saveNodeConfig`,
  `commitToTree` -> `updateNodeConfig`. Cmd+S -> `saveActiveEditor`. Close-while-dirty -> the
  existing editor close-confirm path.

### Drop blur-autosave

Remove the `saveNodeConfig` calls inside the five panels; their `onChange` now feeds drafts.
The key-value grid + script field already buffer locally and flush on blur/unmount via
`onChange`, so re-targeting `onChange` to a draft setter preserves "switch never loses a
keystroke" without persisting.

## Files

### Modify

- `src/components/workspace/workspace-context.tsx`
  - `RequestOverride` += `config`.
  - `setRequestConfig(id, config)` + expose on context + type.
  - `dirtyRequestIds`: deep-equal compare for the `config` field (other fields stay `!==`).
- `src/components/workspace/config-panels.tsx`
  - The five panels take `onChange(config: ConfigScope)` (controlled); remove internal
    `saveNodeConfig`. Keep `id` only if still needed for labels.
- `src/components/workspace/request-pane.tsx`
  - Pass `onChange={(config) => setRequestConfig(request.id, config)}` to each panel.
- `src/components/workspace/folder-pane.tsx`
  - Hold `draftConfig`; pass `onChange` to panels; register an `activeEditor` (dirty/save/
    commitToTree) so Cmd+S + close-confirm work for folders.

### Create

- Tests:
  - `src/components/workspace/__tests__/panel-explicit-save-context.test.tsx` - request panels:
    no autosave on blur (AC-001), Cmd+S persists + clears dirty (AC-002/003), switch keeps
    draft (AC-004), revert clears dirty (AC-005), close-confirm (AC-006).
  - `src/components/workspace/__tests__/folder-explicit-save.test.tsx` - folder: edit -> dirty,
    Cmd+S persists, close confirms (AC-007).
  - Possibly a small `deep-equal` unit test if a helper is extracted.

## Edge cases (from spec section 6)

- Deep-equal dirty (AC-005); sub-tab unmount flushes to draft not persist (AC-004); Settings +
  structured share one request, Cmd+S single save path (AC-002/008); folder via activeEditor
  seam (AC-007).

## Tests to write (>= 1 per AC)

| AC | Test |
| -- | ---- |
| AC-001 | edit header, blur -> onTreeChange NOT called |
| AC-002 | Cmd+S on Auth -> onTreeChange called + toast |
| AC-003 | edit -> dirty dot; after save -> gone |
| AC-004 | edit, switch sub-tab/request, back -> draft intact + dirty |
| AC-005 | edit then revert -> not dirty |
| AC-006 | close dirty -> confirm; Save persists, Discard drops |
| AC-007 | folder edit -> dirty, Cmd+S persists, close confirms |
| AC-008 | Settings/.env/theme still explicit-save (existing tests stay green) |

## Status: DONE

AC -> proving test (all green; full suite 1206/1206):

| AC | Test (file) |
| -- | ----------- |
| AC-001 | "should NOT call onTreeChange if a header/variable/bearer ... is edited and blurred" (panel-explicit-save-context) |
| AC-002 | "should persist the edited auth config and show a Saved toast if the save action fires" (panel-explicit-save-context) |
| AC-003 | "should show the dirty dot after an edit and clear it after the save action" (panel-explicit-save-context) |
| AC-004 | "should keep the draft and stay dirty without persisting if the sub-tab is switched away and back" (panel-explicit-save-context) |
| AC-005 | "should clear the dirty dot if an edited value is reverted to its on-disk value" (panel-explicit-save-context) |
| AC-006 | "should open the confirm dialog ..." + "... if the dialog Save is used" + "... Discard ..." (panel-explicit-save-context) |
| AC-007 | folder-explicit-save: dirty-no-persist / save persists / close confirms |
| AC-008 | "should persist the Settings JSON value, not the structured draft, when both are touched" (folder-explicit-save) + existing request-settings-tab/theme/env suites stay green |

Deviation from plan: the folder structured editor became a SEPARATELY-MOUNTED child
(`FolderStructuredEditor`, gated by a `tab !== "settings"` render ternary) instead of a
`tab`-gated effect in FolderPane - a verifier caught that the gated effect raced the Settings
RawJsonEditor for the single `activeEditor` slot and could clobber the raw-JSON save. The
mount-based split makes ownership deterministic (mutually-exclusive mount/unmount). Logged in
docs/learnings.md.

## Execution order

1. RED: write the context + folder tests (failing: today autosaves on blur / Cmd+S no-ops).
2. GREEN: `RequestOverride.config` + `setRequestConfig` + deep-equal dirty; controlled panels;
   wire request-pane + folder-pane.
3. REFACTOR: extract a `deepEqual`/config-equal helper if it tightens the compare; dedupe.
4. VERIFY: lint, typecheck, full `npm test`; fresh verifier; live app check (Cmd+S toast on
   Auth tab, dirty dot, switch-keeps-draft, close-confirm).

## Risks

- **Existing autosave tests:** `editable-config-panels.test.tsx` asserts blur persists via
  `saveNodeConfig`. Those assertions invert under this feature - update them to assert the
  draft+Cmd+S behavior (they're testing the old contract). Expect to rewrite ~that file.
- **Deep-equal cost:** config is small; `JSON.stringify` compare on the config slice is fine.
- **Double-save (Settings + panel):** ensure Cmd+S routes to exactly one save path
  (editor-saver precedence already exists). Cover with a test.
