# Plan: Consistent macOS-style scrollbars

Derived from `spec.md` (approved 2026-06-25). Pure-visual unification: one scrollbar treatment
everywhere via Radix `ScrollArea` (overlay + auto-hide) + a matching thin `::-webkit-scrollbar`
CSS fallback for surfaces that own their internal scroller.

**Coverage threshold:** none enforced (`vitest.config.ts` has no `thresholds`).

## Task breakdown

1. **Restyle shared `ScrollArea`** (`src/components/ui/scroll-area.tsx`)
   - `Root`: add explicit `type="hover"` (auto-hide intent) + a `scrollHideDelay` (e.g. 600).
   - `ScrollBar`: thin track - vertical `w-1.5`, horizontal `h-1.5`; drop `p-px`, `border-l`,
     `border-t` and their transparent borders; keep `flex touch-none select-none transition-colors`.
   - `Thumb`: `bg-foreground/20 hover:bg-foreground/30`; remove `bg-border`; **no** `rounded-*`.

2. **Global thin scrollbar CSS** (`src/index.css`, inside `@layer base`)
   - `* { scrollbar-width: thin; scrollbar-color: color-mix(...) transparent; }`
   - `::-webkit-scrollbar { width: 8px; height: 8px; }`
   - `::-webkit-scrollbar-track { background: transparent; }`
   - `::-webkit-scrollbar-thumb { background: color-mix(in oklch, var(--foreground) 20%, transparent);
     border: 2px solid transparent; background-clip: padding-box; }` (no `border-radius`)
   - `:hover` thumb -> 35%; `::-webkit-scrollbar-corner { background: transparent; }`

3. **Wrap raw regions in `ScrollArea`**
   - `content.tsx` settings body: `div.flex-1.overflow-auto.p-6` -> `ScrollArea.flex-1` wrapping a
     `div.p-6`.
   - `response-pane.tsx`:
     - `TooLargeBody`: `<pre>` (keep, drop its `overflow-auto`) inside a `ScrollArea` filling the
       remaining height.
     - `ResponseBody` JSON-viewer wrapper: `div.min-h-0.flex-1.overflow-auto` -> `ScrollArea`.
     - "No match" div + `Input` left unchanged (never scroll).

4. **Doc the contract** (`docs/design.md`)
   - Add a "Scrollbars" line to the visual contract: thin, square, semi-transparent overlay,
     auto-hide via `ScrollArea`; CSS fallback for CM editors + Select/Command popovers; no rounding.

## Execution order (TDD)

1. **RED** - fresh test-writer subagent writes failing tests from the ACs/TCs (see spec §5).
2. **GREEN** - implement tasks 1-3 (smallest change per AC). One commit per AC group.
3. **REFACTOR** - tidy class strings; keep tests green.
4. **VERIFY** - fresh verifier subagent runs gates + adversarial edge probing.
5. **WEBVIEW CHECK** (manual, the real test for a visual change) - `npm run dev`, drive in
   chrome-devtools: sidebar/console overlay thumb thin+square+auto-hide, no double bar; CM editors
   + a long Select/palette list show the thin bar; light + dark both readable. Screenshot.

## File changes

| File                                          | Change                                              |
| --------------------------------------------- | --------------------------------------------------- |
| `src/components/ui/scroll-area.tsx`           | thin/square/semi-transparent thumb + `type="hover"` |
| `src/index.css`                               | global `::-webkit-scrollbar` + `scrollbar-*` thin   |
| `src/components/workspace/content.tsx`        | wrap settings body in `ScrollArea`                  |
| `src/components/workspace/response-pane.tsx`  | wrap `TooLargeBody` + JSON-viewer in `ScrollArea`   |
| `docs/design.md`                              | scrollbar contract note                             |
| test file(s) under existing layout            | new DOM + CSS tests for AC-001..004                 |

## Acceptance verification

- AC-001 -> TC-001/002 (ScrollArea thin/square/semi-transparent + `type="hover"`).
- AC-002 -> TC-003 (index.css rule block content).
- AC-003 -> TC-004/005/006 (regions route through `data-slot="scroll-area"`).
- AC-004 -> TC-007 (no rounded / no `bg-border` on any scrollbar slot).
- AC-005 -> TC-008 (`npm test` + `npm run typecheck` + `npm run build`).
- Manual webview check (overlay, auto-hide, no double bar, CM/popover thin bar, both themes).

## Status: DONE (verified 2026-06-25)

Fresh-context verifier: PASS on AC-001..005 + all gates (typecheck clean, 943/943 vitest, build ok).

### AC -> test traceability

| AC     | Test name                                                                                      | File                                  |
| ------ | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| AC-001 | `should render a thin (w-1.5) scrollbar track and not the old w-2.5 if mounted`                | `ui/__tests__/scroll-area.test.tsx`   |
| AC-001 | `should render a semi-transparent foreground thumb that is square and not bg-border if mounted`| `ui/__tests__/scroll-area.test.tsx`   |
| AC-001 | `should configure the Radix scroll-area for hover auto-hide if mounted`                        | `ui/__tests__/scroll-area.test.tsx`   |
| AC-002 | `should declare scrollbar-width: thin in index.css` (+ 5 sibling CSS-content tests)            | `ui/__tests__/scroll-area.test.tsx`   |
| AC-003 | `should render the settings body inside a data-slot scroll-area if settings is active`         | `workspace/__tests__/scrollbar-wrapped-regions.test.tsx` |
| AC-003 | `should render the too-large preview pre inside a data-slot scroll-area if the body exceeds the limit` | `workspace/__tests__/scrollbar-wrapped-regions.test.tsx` |
| AC-003 | `should render the JSON viewer wrapper as a data-slot scroll-area if the body is valid JSON under the limit` | `workspace/__tests__/scrollbar-wrapped-regions.test.tsx` |
| AC-004 | `should not carry rounded-full, rounded-xs or bg-border on any scrollbar slot if mounted`      | `ui/__tests__/scroll-area.test.tsx`   |
| AC-005 | full gates (typecheck + `vitest run` 943 green + build)                                        | CI gates                              |

### Deviations from plan

- Test-writer's initial RED was a wrong-reason red: Radix `ScrollArea` with an auto-hide `type`
  never mounts the scrollbar/thumb slot under jsdom, so the rendered-class tests failed on
  "null not to be null" against *any* code. Fixed by forcing `type="always"` in the test render
  (mounts the bar) and reading the thumb className + CSS rules from source (the thumb never mounts
  in jsdom at all). Production stays `type="hover"`.

## Risks

- **Radix vs global CSS double bar inside ScrollArea:** mitigated by Radix's higher-specificity
  viewport selector; confirmed in webview (edge case §6).
- **`color-mix`/`oklch` webview support:** WKWebView is modern Safari; both supported. If a target
  is older, fall back to a fixed `rgb(... / .2)`. Verify in webview.
- **Tab strip not wrapped:** accepted (dnd-kit drag math); relies on global CSS bar. Re-evaluate if
  it looks off.
- **Thumb invisible in one theme:** `bg-foreground/20` flips with theme; bump opacity if it
  disappears (checked in the manual pass).
