# Plan: Themes (light / dark / system + custom colors)

**Spec:** [spec.md](spec.md)
**Branch:** `20260625155948-themes`
**Approach:** one branch, three sequenced stages (see spec §14). TDD per stage (RED → GREEN → REFACTOR).

## Key decisions / patterns

- **Model is file-agnostic; the split lives only in the Tauri adapter** (learnings #45). `Settings` gains a
  single `theme: ThemeSettings` field (`mode` + `colors`). `createTauriSettingsStore` strips `theme.colors`
  into `theme.json` and keeps `theme.mode` in `settings.json`, exactly as it already strips `shortcuts` into
  `keymap.json`. `mergeSettings`, the context, and the in-memory store never know about the file boundary,
  so their tests don't change shape.
- **No `Settings.version` bump.** `theme` is tolerant-merged like `workspacePath`/`activeEnvironment` were
  added - a settings.json without `theme` loads to the default.
- **Sparse overrides + canonical default table.** `theme-defaults.ts` holds the built-in light/dark app
  tokens (mirroring `index.css`) and the built-in light/dark editor schemes. `theme.json` stores only the
  diff. The JSON editor is seeded with the full *effective* set (defaults merged with overrides) so every
  token is discoverable; on save, `diffOverrides` strips back to the diff.
- **Apply via inline CSS vars on `document.documentElement`** for the active effective mode, plus the
  `.dark` class toggle. Inline style beats the `:root`/`.dark` stylesheet rules, and Tailwind's
  `@theme inline` re-derives `--color-*` from the base vars - so only the active mode's overrides need to
  be written, and a mode flip clears + reapplies.
- **Editors become color-driven factories.** `editor-theme.ts` exports `makeChrome(colors,isDark)`,
  `makeHighlight(colors)`, `makeEditorExtensions(...)`, `makeViewerExtensions(...)`. A `useEditorColors()` /
  `useEditorExtensions()` hook (fed by the theme context) returns memoized extensions; the 6 CM consumers
  consume the hook instead of module consts. Chrome bg stays `transparent` (inherits the pane) so the light
  scheme needs no solid bg and the white-flash gotcha (learnings #49) stays avoided.
- **No new dependency.** Colors are `oklch(...)` strings edited as JSON; no color conversion.

## Glossary terms sharpened

- **Mode** = the user's *choice* (`light` | `dark` | `system`). **Effective mode** = the resolved
  concrete scheme actually applied (`light` | `dark`), equal to Mode unless Mode is `system`, in which case
  it's `matchMedia`-derived. (Recorded in `.pzielinski/glossary.md` if/when it accumulates - app uses
  `docs/` not a committed glossary; keep this inline for now.)
- **App token** = a shadcn CSS var driving app chrome (`--background`, ...). **Editor token** = a CodeMirror
  syntax/caret/selection color. Both are *theme tokens*; the customizable set is 18 + 9.

---

## Stage 1 - Mode (light / dark / system)

### Files

- **`src/lib/settings/settings.ts`** (modify): add `ThemeMode`, `ThemeSettings` (mode-only for now),
  `theme` field on `Settings`, `DEFAULT_SETTINGS.theme = { mode: "system", colors: {light:{tokens:{},editor:{}}, dark:{...}} }`,
  and a `mergeTheme(partial)` folded into `mergeSettings` (tolerant: bad/absent → default mode).
- **`src/lib/settings/settings-context.tsx`** (modify): add `saveThemeMode(mode: ThemeMode)` (mirrors
  `saveActiveEnvironment`).
- **`src/lib/theme/effective-mode.ts`** (new, pure): `resolveEffectiveMode(mode, prefersDark): "light"|"dark"`.
- **`src/lib/theme/theme-context.tsx`** (new): `ThemeProvider` that reads `settings.theme.mode`, subscribes
  to `matchMedia("(prefers-color-scheme: dark)")` (guarded for absence), computes the effective mode, and in
  a layout effect toggles `.dark` on `document.documentElement`. Exposes `useTheme()` →
  `{ mode, effectiveMode, setMode }`. Mounted in `__root.tsx` **inside** `SettingsProvider` (so it can read
  settings), wrapping `ToastProvider` + children:
  `SettingsProvider → ThemeProvider → ToastProvider → {children}`.
- **`src/components/settings/theme-section.tsx`** (new): a mode selector (3 segmented buttons or a radio
  group, square per design.md - reuse `Button` / native radios, NOT a rounded control). Calls `setMode`.
- **`src/components/workspace/content.tsx`** (modify): render `<ThemeSection />` above `<ShortcutsSection />`
  in the settings body.
- **`src/routes/__root.tsx`** (modify): insert `<ThemeProvider>` between the existing `<SettingsProvider>`
  and `<ToastProvider>` (current order is `SettingsProvider → ToastProvider → children`).

### Tests (RED first)

- `settings.test.ts`: `mergeSettings` defaults `theme.mode` to `"system"`; tolerates missing/garbage
  `theme`; preserves a valid `theme.mode`.
- `effective-mode.test.ts`: `system`+prefersDark→dark; `system`+!prefersDark→light; `light`→light;
  `dark`→dark (ignores prefersDark).
- `theme-context.test.tsx`: rendering with `theme.mode:"dark"` puts `.dark` on `<html>`; `"light"` removes
  it; `"system"` follows a stubbed `matchMedia` and **flips on a dispatched `change`** (AC-003 live flip).
- `theme-section.test.tsx`: selecting Dark calls `saveThemeMode("dark")`; the active mode reads as selected.
- `settings-context` test: `saveThemeMode` persists through the store (in-memory).

### jsdom notes

- Stub `matchMedia` in the test (jsdom lacks it) returning a controllable `{matches, addEventListener}`;
  dispatch a fake `change` to assert the live flip. Guard the provider so a missing `matchMedia` → light.
- `ThemeProvider` mounts under `SettingsProvider`; tests that render it use `createInMemorySettingsStore`.

### AC coverage

AC-001, AC-002, AC-003, AC-004 (+ AC-013 mode half).

---

## Stage 2 - App-token customization

### Files

- **`src/lib/theme/theme-defaults.ts`** (new): `APP_TOKENS: AppTokenName[]`, `EDITOR_TOKENS` (declared now,
  used in Stage 3), and `DEFAULT_THEME_COLORS: { light, dark }` with the full app-token oklch values copied
  from `index.css` (`:root` → light, `.dark` → dark). Single source of truth for "built-in default".
- **`src/lib/settings/settings.ts`** (modify): flesh out `ThemeColorOverrides`/`ThemeColors`/`ThemeSettings`
  (already declared in Stage 1 as empty maps); add `AppTokenName`/`EditorTokenName` unions; tolerant
  `mergeThemeColors` (keyed to the known unions, drops unknown keys / non-string values).
- **`src/lib/settings/settings-context.tsx`** (modify): `saveThemeColors(colors: ThemeColors)`.
- **`src/lib/settings/tauri-store.ts`** (modify): add `THEME_FILE = "theme.json"`, `THEME_KEY = "colors"`;
  on `save`, strip `theme.colors` → `theme.json` (write `theme: { mode }` only into settings.json); on
  `load`, overlay `theme.json`'s colors onto the merged settings. Mirrors the `keymap.json` split exactly.
- **`src/lib/theme/overrides.ts`** (new, pure): `applyDefaults(overrides, defaults): ThemeColors` (full
  effective set) and `diffOverrides(edited, defaults): ThemeColors` (sparse).
- **`src/lib/theme/apply-vars.ts`** (new, pure-ish): `applyThemeVars(el, effectiveMode, effectiveColors)` -
  set each app-token inline var that differs from default (or set all of the active set; clearing the
  others) on the element; `--token` names map 1:1 to `AppTokenName`. Also exported: the var-name mapping.
- **`src/lib/theme/theme-context.tsx`** (modify): compute `effectiveColors = applyDefaults(settings.theme.colors, DEFAULT_THEME_COLORS)`;
  in the apply effect, after the `.dark` toggle, call `applyThemeVars(documentElement, effectiveMode, effectiveColors[effectiveMode])`.
  Expose `colors`, `effectiveColors`, `setColors` on `useTheme()`.
- **`src/components/workspace/config-editor.tsx`** (modify): **export** the currently-local
  `RawJsonEditor<T>` (line 54) so the theme section can reuse it. (It's a generic shell: seeds from `saved`,
  registers an `ActiveEditor`, Save disabled on invalid JSON, Mod+S / close-popup save.)
- **`src/components/settings/theme-section.tsx`** (modify): add the raw-JSON editor via the now-exported
  `RawJsonEditor<ThemeColors>` - seed = `JSON.stringify(applyDefaults(colors,defaults), null, 2)`,
  parse = a validator that requires the `{light:{tokens,editor}, dark:{...}}` shape (else null → Save
  disabled); on save → `setColors(diffOverrides(parsed, defaults))`.

### Tests (RED first)

- `theme-defaults.test.ts`: the table has all 18 app tokens for both modes and the values are valid
  `oklch(...)` strings (cross-check a couple against `index.css`).
- `overrides.test.ts`: `applyDefaults` layers a sparse override over defaults; `diffOverrides` keeps only
  differing entries and drops a token edited back to default (whitespace-insensitive compare); round-trip
  `diff(apply(x)) === x` for a sparse `x`.
- `apply-vars.test.ts`: sets `--primary` inline when overridden; a mode with no overrides leaves no stray
  inline vars / clears a previously-set one.
- `settings.test.ts`: `mergeThemeColors` keeps known tokens, drops unknown keys and non-string values,
  tolerates a missing `colors`.
- `tauri-store.test.ts` (if present) / a new adapter test: `save` writes colors to the theme store and
  `theme: {mode}` (no colors) to the settings store; `load` recombines. (Mirror the existing keymap split
  test if one exists; else add one with a fake `LazyStore`.)
- `theme-context.test.tsx`: an override on light `primary` sets the `--primary` inline var when effective
  mode is light; switching to dark clears it and applies dark's set.
- `theme-section.test.tsx`: editing the JSON to a new `primary` then saving calls `setColors` with the
  sparse diff; invalid JSON disables save (assert via the `RawJsonEditor` lint/save-disabled contract used
  by the existing config-editor tests).

### jsdom notes

- The `RawJsonEditor`/CM save path has documented flaky timing under full-suite load (learnings #139) - keep
  the theme-section save test isolated-friendly (own file) and use the `await act(async dispatch)` + blur
  pattern (learnings #130), or drive `setColors` through the editor's registered `save()` via a harness
  rather than the `Mod+S` hotkey, as the config-editor tests do.
- Reading `index.css` to assert the defaults table matches: use the `readFileSync` + file-local
  `/// <reference types="node" />` trick (learnings #137) since the app tsconfig excludes node types.

### AC coverage

AC-005, AC-006, AC-007, AC-008, AC-009 (+ AC-013 colors half).

---

## Stage 3 - Editor theming (follow mode + customizable)

### Files

- **`src/components/workspace/editor-theme.ts`** (modify): keep the existing `darcula` palette as the
  **dark** built-in editor scheme; add a **light** built-in scheme (`EDITOR_DEFAULTS.light` in
  `theme-defaults.ts`, oklch or hex - CM takes any CSS color). Replace the `darculaChrome`/`darculaHighlight`/
  `jsonViewerExtensions` consts with factories: `makeChrome(colors, isDark)`, `makeHighlight(colors)`,
  `makeEditorExtensions({colors,isDark,linter?,closeBrackets?})`, `makeViewerExtensions({colors,isDark,fold?})`.
  Keep `emptyTolerantJsonLinter` as-is.
- **`src/lib/theme/theme-defaults.ts`** (modify): add `EDITOR_TOKENS` (9) and `DEFAULT_EDITOR_COLORS:{light,dark}`
  (dark = the current darcula values; light = a new readable light palette).
- **`src/components/workspace/use-editor-extensions.ts`** (new hook): reads `useTheme().effectiveColors` +
  `effectiveMode`, returns memoized `{ bodyExtensions, viewerExtensions, scriptExtensions(stage), ... }` or a
  small set of builders, keyed on the effective editor colors + isDark so CM reconfigures on theme change.
- **Wire the 6 consumers** (modify): `body-editor.tsx`, `config-editor.tsx`, `env-editor.tsx`,
  `script-editor.tsx`, `json-viewer.tsx`, `console.tsx` - swap module-const `extensions` for the hook output.
  (Each already imports from `editor-theme`; change the import to the hook + factory.)
- **`src/components/settings/theme-section.tsx`** (modify): the JSON editor already round-trips the whole
  `ThemeColors` incl. the `editor` sub-maps - so editor tokens are editable once the defaults table + merge
  include them (done in Stage 2's model). No extra UI.

### Tests (RED first)

- `editor-theme.test.ts` (extend existing `body-editor-theme.test.tsx` neighbors): `makeHighlight(dark)`
  yields the darcula string color; `makeHighlight(light)` yields the light string color; `makeChrome(_,true)`
  carries `{dark:true}`, `makeChrome(_,false)` `{dark:false}`; chrome bg stays `transparent` in both.
- `use-editor-extensions.test.tsx`: returns different highlight extensions for light vs dark effective mode;
  memoizes (same identity when colors unchanged).
- A consumer integration test (e.g. `body-editor`): rendering under a dark `ThemeProvider` then re-rendering
  under light changes the injected highlight rule **without** unmounting the editor (assert the live doc
  survives - `EditorView.findFromDOM(...).state.doc` unchanged; learnings #46/#130 for driving CM).
- Override test: a custom dark `string` color in `theme.json` flows through `effectiveColors.dark.editor`
  into `makeHighlight` (assert the highlight style carries the custom color).

### jsdom notes

- CM themes are global `StyleModule` rules deduped across the run and inject into `document.head`
  (learnings #49) - assert via the **factory output** (the `HighlightStyle`/`EditorView.theme` spec object)
  and the merged `effectiveColors`, not by reading a pixel. For the "swap without remount" check, read the
  live `EditorView` doc string before/after a theme re-render.
- Don't pass `theme=` prop alongside the custom extension (double-theming, learnings #50); keep `theme="none"`.

### AC coverage

AC-010, AC-011, AC-012.

---

## Execution order

1. Stage 1 (mode) RED → GREEN → REFACTOR → run `npm test` + `npm run typecheck` + `npm run lint`.
2. Stage 2 (app colors) same loop.
3. Stage 3 (editor theming) same loop.
4. Full verifier pass (fresh agent) over the whole diff once all three stages land.
5. Manual webview check (the parts jsdom can't prove - learnings #121/#129): `npm start`, switch
   light/dark/system, edit a color in the Theme JSON, confirm app + editors recolor live; confirm
   `settings.json` has only `theme.mode` and `theme.json` has the colors. **Shut the app down after**
   (`pkill` per CLAUDE.md).

## Commits

One per AC-ish slice, `feat(themes): <desc>` (this repo uses feature-slug, not a ticket id, in the scope):

- `feat(themes): add theme mode model + tolerant merge`
- `feat(themes): resolve + apply effective mode (.dark toggle, system matchMedia)`
- `feat(themes): mode selector in settings`
- `feat(themes): theme.json adapter split + ThemeColors model`
- `feat(themes): canonical default table + sparse override diff/apply`
- `feat(themes): apply app-token overrides as inline css vars`
- `feat(themes): raw-JSON color editor in settings`
- `feat(themes): light editor scheme + color-driven editor-theme factories`
- `feat(themes): editors follow + honor custom theme colors`

## Doc drift (pre-commit)

- **README.md**: the "Per-installation UI settings ... persist to a `settings.json`" + "`keymap.json`"
  paragraph gains `theme.json` (custom colors) and a note that mode lives in `settings.json`. Mention the
  Settings → Theme section (mode + JSON color editor).
- **CLAUDE.md / docs/design.md**: design.md §"Color & status" already says "Theme via CSS tokens ... so
  light/dark both work" - update to note the mode is now user-selectable + customizable, and that the
  `.dark` block is now live (no longer dead). Add a learnings entry for the inline-var application + the
  editor-factory refactor + the theme.json split.
- **docs/adr.md**: candidate ADR - "custom colors edited as raw JSON, not a picker" + "apply overrides as
  inline CSS vars". Offer it at the end (hard-to-reverse-ish, surprising, real alternative existed).

## Acceptance verification (filled after implementation)

AC → test-name table to be completed once the verifier passes (spec §2 lists AC-001..013).
