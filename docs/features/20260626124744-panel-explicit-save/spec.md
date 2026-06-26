# Spec: Explicit Save for Structured Config Panels

**Version:** 0.1.0
**Created:** 2026-06-26
**Status:** Draft

## 1. Overview

Today the structured request/folder config panels (Vars, Auth, Headers, Params, Script)
**autosave on blur** via `saveNodeConfig`. The raw-JSON Settings/`.env`/theme editors instead
use an explicit Cmd+S save with a dirty dot. This split surprises users: Cmd+S on the Auth
tab does nothing (no toast, no save), and the "Saved" toast they see on Send is actually the
focused field's blur firing.

This feature makes the structured panels behave **exactly like the raw-JSON editors and like
Bruno/Postman**: edits go into a draft, the tab/pane shows a dirty dot, and **Cmd+S persists
the whole current request/folder** (with the "Saved" toast). Switching sub-tab or request tab
keeps the draft and the dirty dot (no autosave). Closing a dirty tab triggers the existing
confirm dialog.

### Decisions captured (user)

- **Cmd+S anywhere saves everything in the current card** (request or folder), regardless of
  which sub-tab (Vars/Auth/Headers/Params/Script/Settings) is active.
- **Editing then switching** sub-tab OR request tab marks the card **dirty** (dot), does NOT
  autosave.
- **Closing a dirty card** prompts the existing save/discard confirm dialog.
- **Dirty check is deep-equal vs saved**: reverting an edit back to the on-disk value clears
  the dirty state (no stale dot).
- **Folders too**: folder config panels get the same draft + Cmd+S model (not just requests).
- **Drop blur-autosave** from all five structured panels.

### Scope boundary

- **In:** Vars/Auth/Headers/Params/Script panels for both request and folder panes; their
  draft state, dirty marking, Cmd+S persist, and close-confirm.
- **Out:** the raw-JSON Settings tab, `.env` editor, theme editor - already explicit-save.
- **Out:** any on-disk format change, new persistence path, Rust change.

## 2. Acceptance Criteria

- AC-001: Editing a value in any structured **request** panel (Vars/Auth/Headers/Params/Script)
  does NOT persist on blur; `onTreeChange` is not called until Cmd+S.
- AC-002: Cmd+S (the `save-active-editor` action) while any request structured panel is active
  persists the whole request via the existing tree-write path and shows the "Saved" toast.
- AC-003: After editing a request panel, the request tab shows the dirty dot; it clears once
  Cmd+S persists.
- AC-004: Editing a request panel then switching sub-tab (e.g. Vars -> Auth) or switching to a
  different request tab keeps the edit in the draft and keeps the dirty dot (no autosave, no
  data loss).
- AC-005: Reverting an edited value back to its on-disk value clears the dirty dot
  (deep-equal compare), and Cmd+S then has nothing to persist.
- AC-006: Closing a request tab with unsaved structured-panel edits triggers the existing
  confirm dialog (Save / Discard / Cancel); Save persists, Discard drops the draft.
- AC-007: The same applies to **folder** config panels: edit -> dirty (no autosave), Cmd+S
  persists the folder, close-while-dirty confirms.
- AC-008: The raw-JSON Settings/`.env`/theme editors keep working exactly as before (still
  explicit-save, still gated by JSON validity).

## 3. User Test Cases

- TC-001 (no autosave): Edit a header value, blur the input (tab away within the grid) -> no
  `onTreeChange`. Maps to: AC-001.
- TC-002 (cmd+s saves): Edit the bearer token on the Auth tab, press Cmd+S -> request persists,
  "Saved" toast appears. Maps to: AC-002, AC-003.
- TC-003 (switch keeps draft): Edit a var, switch to the Auth sub-tab, switch back -> the edit
  is still there, dirty dot still shown, nothing persisted. Maps to: AC-004.
- TC-004 (revert clears dirty): Edit a value then type it back to the original -> dirty dot
  gone. Maps to: AC-005.
- TC-005 (close confirms): Edit a param, close the tab -> confirm dialog; Save persists, Discard
  drops. Maps to: AC-006.
- TC-006 (folder): Edit a folder's Vars, Cmd+S persists; edit + close prompts confirm. Maps to:
  AC-007.

## 4. UI States

| State | Behavior |
| ----- | -------- |
| Clean | No dirty dot; Cmd+S is a no-op (nothing to save). |
| Dirty (edited, unsaved) | Dirty dot on the tab/pane; draft retained across sub-tab/tab switches. |
| Saving (Cmd+S) | Persists via existing path; toast "Saved"; dirty dot clears. |
| Closing dirty | Existing confirm dialog (Save / Discard / Cancel). |

## 5. Data Model

No persisted-data change. The request draft reuses the existing `requestOverrides` map by
adding `config` to its `RequestOverride` shape. Folder drafts reuse the existing `activeEditor`
registration seam (the same one the folder raw-JSON editor uses). Dirty is **derived**
(deep-equal of draft config vs saved config), never stored.

## 6. Edge Cases

- **Object reference vs value:** config is an object, so dirty must be **deep-equal** (a
  re-created-but-equal config is NOT dirty). AC-005.
- **Sub-tab unmount flush:** the key-value grid already flushes its local row draft to
  `onChange` on unmount; with the new model `onChange` writes the draft (not a persist), so a
  tab switch never loses a pending keystroke (existing behavior, re-targeted). AC-004.
- **Settings tab + structured edits on the same request:** the Settings raw-JSON editor and the
  structured panels edit the same request; saving must not double-persist or clobber. Cmd+S
  routes to one save path (editor-saver precedence preserved). AC-002, AC-008.
- **Invalid draft:** structured panels can't produce invalid JSON (typed inputs), so the
  request draft is always saveable; the JSON-validity gate only applies to the raw-JSON tab.
- **Folder with no open tab:** a folder pane isn't a request tab; its dirty + Cmd+S + confirm
  use the `activeEditor` seam, exactly like the folder raw-JSON editor today. AC-007.

## 7. Dependencies

- Reuses: `requestOverrides`/`mergeOverride`, `dirtyRequestIds`, `saveActiveRequest`,
  `saveActiveEditor`, `registerActiveEditor`, the close-confirm dialog, the content-header
  dirty dot. No new deps, no Rust change.
- Touches: `config-panels.tsx` (the five panels become controlled), `request-pane.tsx`,
  `folder-pane.tsx`, `workspace-context.tsx` (`RequestOverride` += `config`,
  `setRequestConfig`, deep-equal dirty compare).
