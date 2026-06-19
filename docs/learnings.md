# Learnings

Project-specific conventions, gotchas, and constraints worth recording so future-you (human or agent) doesn't re-derive them. Append-only. For architectural trade-offs use [adr.md](adr.md) instead.

## Entries

<!-- Format: one bullet per learning. Date prefix optional. -->

- TanStack Hotkeys split: `@tanstack/hotkeys` is the framework-agnostic core (no React hook). The React `useHotkey` + `HotkeysProvider` live in `@tanstack/react-hotkeys`. Install the adapter, not the core.
- Hotkey strings are case-sensitive in the typed union: use uppercase keys, e.g. `"Mod+K"` not `"Mod+k"`.
- Under jsdom the hotkeys lib resolves `Mod` to `Control` (test platform reports non-mac), so hotkey tests fire `{Control>}k{/Control}`, not Meta.
- ESLint react-hooks v7 false-positives: `useReactTable` trips `react-hooks/incompatible-library`; code-based TanStack route files trip `react-refresh/only-export-components`. Both scoped off in eslint.config.js for the relevant paths.
- shadcn Button keeps `react-refresh/only-export-components` as an accepted warning (canonical upstream file exports `buttonVariants` alongside the component). Lint exits 0 with warnings.
- `npm create tauri-app` can't target a non-empty dir: scaffold in temp, copy `src-tauri/` + vite/ts configs + `index.html` in, then rewrite identity (Cargo `name`, `tauri.conf.json` productName/identifier, `main.rs` `_lib` ref).
- shadcn `resizable` ships for the old `react-resizable-panels` API: it passes `direction` to `ResizablePanelGroup`, but v4 renamed the prop to `orientation` ("horizontal"|"vertical"). The generated `resizable.tsx` types are fine; fix the prop at call sites or typecheck fails.
- react-resizable-panels v4 `Panel` size props (`defaultSize`/`minSize`/`maxSize`) read a bare `number` as PIXELS, not percent. `defaultSize={20}` = 20px wide. For proportional panels pass a string with a unit: `defaultSize="20%"`. (Symptom: a panel renders a few px wide and won't expand past its px `maxSize`.)
- jsdom has no `ResizeObserver`; radix Select/Tabs + react-resizable-panels need it. A no-op `ResizeObserver` stub is installed in `src/test/setup.ts`. Also expect harmless "Not implemented: Window's scrollTo()" noise from shadcn `ScrollArea` under jsdom.
- radix `SelectValue` renders nothing until the dropdown opens (items live in an unmounted Portal), and jsdom can't open it. To assert the current value in tests, render the value as explicit `SelectTrigger` children instead of relying on `<SelectValue/>`.
- react-resizable-panels v4 persistence: pass `defaultLayout` (a `{panelId: number}` map) + `onLayoutChanged` to `Group` (our `ResizablePanelGroup`, which spreads props through). `onLayoutChanged` fires on pointer release (use it for saving, not `onLayoutChange` which fires per-move). Panels need stable string `id`s for the map keys. When a group has no saved layout, pass `defaultLayout={undefined}` and the lib falls back to each panel's `defaultSize`.
- `nvm` on this machine is shimmed to print "use `mise` instead" and does nothing; node is managed by mise (`.nvmrc` pins 24, mise has 24.17.0). In non-interactive bash, activate first: `eval "$(mise activate bash)"` then `mise exec -- <cmd>` to get node 24.
- Anything under `SettingsProvider` (the resizable groups via `useSettings`) only mounts children AFTER the async settings load resolves. Tests rendering `WorkspaceLayout`/`Main`/`Content` must wrap them in `SettingsProvider` (use `createInMemorySettingsStore()`) and use `findBy*`/`waitFor` for the first assertion.
