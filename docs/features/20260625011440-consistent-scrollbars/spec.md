# Spec: Consistent macOS-style scrollbars

**Version:** 0.1.0
**Created:** 2026-06-25
**Status:** Draft

## 1. Overview

Today the app renders **two unrelated scrollbar treatments**, so scrollable regions look
inconsistent:

- **Radix `ScrollArea`** (overlay, custom thumb) - used by the sidebar tree and the console. Thumb
  is a 10px (`w-2.5`) square `bg-border` bar.
- **Raw native `overflow-auto`** - used by the content settings body, the response body / "too
  large" / "no match" panes, the content-header tab strip, and the Radix Select / cmdk Command
  popovers. These render the **OS default scrollbar** (on macOS dev that's the system bar, on
  Windows/Linux a thick gray gutter), so the app looks different per platform and per region.

Goal: **one consistent, macOS-style scrollbar everywhere** - thin, semi-transparent, overlay
(takes no layout gutter), auto-hides when idle, square ends (the repo's no-rounded-corners rule
stands; see decision below). The Tauri app ships macOS + Windows + Linux from one WebView, so
"macOS-style" means *we* draw the bar identically on all three, not "defer to the OS".

### Approach (user-chosen)

**Radix `ScrollArea` everywhere it can reach**, restyled thin/square, plus a **matching thin
`::-webkit-scrollbar` + `scrollbar-*` CSS fallback** in `index.css` for the surfaces that own
their own internal scroller and cannot host a `ScrollArea` (CodeMirror editors, the Radix Select
and cmdk Command popovers). Both sources are tuned to the **same visual** (thickness, color,
hover) so every bar reads identically.

Radix `ScrollArea` is the high-fidelity path: it overlays (no layout shift) and auto-hides, which
is the defining macOS behavior. The CSS fallback is always-visible (webkit can't auto-hide), but
thin + semi-transparent so it reads the same at a glance.

### Scope

- **In:**
  - Restyle the shared `ScrollArea` thumb (`src/components/ui/scroll-area.tsx`): thinner bar,
    semi-transparent `bg-foreground/20` thumb (hover `/30`), square (no radius), overlay; set the
    Radix `type` so it auto-hides like macOS.
  - Wrap the currently-raw scroll regions in `ScrollArea` so they get the overlay/auto-hide
    treatment: the settings body (`content.tsx`), the response panes (`response-pane.tsx`:
    `TooLargeBody` `<pre>`, the JSON-viewer wrapper, the "No match" div).
  - Add a global thin scrollbar CSS rule (`::-webkit-scrollbar` + `scrollbar-width` /
    `scrollbar-color`) in `src/index.css`, tuned to match the `ScrollArea` thumb, covering the
    surfaces that can't host a `ScrollArea`: CodeMirror `.cm-scroller`, the Select popover, the
    Command popover.
  - Document the scrollbar as the visual contract in `docs/design.md`, and add the thumb as a
    second documented exception note to the no-rounded rule **only if** the square-thumb decision
    is reversed (it is not - see Decisions).
- **Out:**
  - The content-header tab strip (`overflow-x-auto`) horizontal scroll - it hosts a `@dnd-kit`
    `SortableContext`; wrapping it in a `ScrollArea` (which re-parents/offsets the viewport) risks
    breaking drag math. It inherits the global CSS thin bar (good enough; it rarely overflows).
    Re-evaluate only if it looks wrong.
  - Any new color tokens, new component, or behavior change to *what* scrolls. Pure visual unification.
  - Changing scroll *behavior* (momentum, scroll-into-view, keyboard) - untouched.

### Decisions captured (user)

- **Thumb shape = square.** macOS uses a rounded pill, but the repo's hard rule is *no rounded
  corners anywhere* (status dots are the sole exception). The thumb stays square; "macOS-style" is
  delivered via *thin + semi-transparent + overlay + auto-hide*, not via rounding.
- **Approach = Radix `ScrollArea` everywhere** (overlay + auto-hide), with a matching CSS fallback
  for the unwrappable surfaces (CodeMirror, Select/Command popovers).

## 2. Design detail

### 2.1 Shared `ScrollArea` thumb (`src/components/ui/scroll-area.tsx`)

- `ScrollArea.Root` gets `type="hover"` (Radix default is also `hover`, set it explicitly for
  intent + a `scrollHideDelay`): the bar shows while scrolling and while hovering the region, then
  fades - the friendly-desktop reading of the macOS "show on scroll" behavior. (`type="scroll"`
  would show *only* during active scroll; `hover` is the better fit for a mouse-driven desktop app
  and what most macOS apps feel like.)
- `ScrollBar`: thinner track. Vertical `w-1.5` (6px) instead of `w-2.5`; horizontal `h-1.5`. Drop
  the `border-l`/`border-t` transparent border + `p-px` (they widen the visual gutter); keep
  `touch-none select-none transition-colors`.
- `ScrollAreaThumb`: `bg-foreground/20 hover:bg-foreground/30` (semi-transparent, theme-driven via
  `--foreground`), **no** `rounded-*` (square per decision). The thumb is `flex-1` so it fills the
  thin track.

### 2.2 Global CSS fallback (`src/index.css`, `@layer base`)

Thin, square, semi-transparent, transparent track - tuned to match 2.1:

```css
* {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in oklch, var(--foreground) 25%, transparent) transparent;
}
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: color-mix(in oklch, var(--foreground) 20%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box; /* inset look without rounding */
}
::-webkit-scrollbar-thumb:hover {
  background: color-mix(in oklch, var(--foreground) 35%, transparent);
  background-clip: padding-box;
}
::-webkit-scrollbar-corner {
  background: transparent;
}
```

No `border-radius` (square per decision). The `border: 2px solid transparent` + `background-clip:
padding-box` gives the thin inset look macOS has, while keeping square ends. Theme-driven via
`--foreground`, so it adapts to light/dark automatically.

**Radix coexistence:** Radix `ScrollArea` hides the *native* scrollbar of its viewport via an
injected `[data-radix-scroll-area-viewport]::-webkit-scrollbar { display: none }` (attribute
selector, specificity 0,1,0) which beats our `*::-webkit-scrollbar` (0,0,1). So inside a
`ScrollArea` only the custom overlay thumb shows - no double bar. (Verified in the webview.)

### 2.3 Wrapped regions

- `content.tsx` settings body: `<div className="flex-1 overflow-auto p-6">` ->
  `<ScrollArea className="flex-1"><div className="p-6">...</div></ScrollArea>`.
- `response-pane.tsx`:
  - `TooLargeBody` `<pre className="... overflow-auto ...">` -> `<pre>` inside a `ScrollArea`
    (keep the `<pre>` for whitespace; move `overflow-auto` to the ScrollArea viewport).
  - `ResponseBody` JSON-viewer wrapper `<div className="min-h-0 flex-1 overflow-auto">` ->
    `ScrollArea`. (The `JsonViewer` is CodeMirror with `height="100%"`; it scrolls *internally* via
    `.cm-scroller`, so this wrapper rarely scrolls - but normalizing it costs nothing and the CM
    inner scroller is covered by 2.2.)
  - "No match" div: keep as-is (single line, never scrolls) - leave unwrapped.

## 3. UI

No new screens. Visual change is the scrollbar appearance only. Same layout, same regions.

### UI States

| State                         | Behavior                                                                         |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Region not overflowing        | No scrollbar visible (overlay, zero gutter) - identical to before.               |
| Region overflowing, idle      | `ScrollArea` regions: thumb hidden (auto-hide). CSS-fallback regions: thin thumb shown. |
| Region overflowing, scrolling | Thin semi-transparent square thumb visible; fades after idle (ScrollArea regions).|
| Hover over scroll region      | `ScrollArea` regions reveal the thumb; CSS-fallback thumb darkens on direct hover.|
| Light / dark theme            | Thumb color tracks `--foreground` (semi-transparent), readable in both.          |

## 4. Acceptance criteria

- **AC-001:** The shared `ScrollArea` renders a **thin** (≤ 6px track), **square** (no
  `rounded-*`), **semi-transparent** (`bg-foreground/20`, hover `/30`) thumb and sets an explicit
  Radix `type` (`hover`) for auto-hide - asserted by a unit/DOM test on the rendered
  `scroll-area-scrollbar` / `scroll-area-thumb` slots (classes present; no `rounded` / `bg-border`).
- **AC-002:** `src/index.css` defines a global thin scrollbar: `scrollbar-width: thin`,
  `scrollbar-color` set, and `::-webkit-scrollbar` width/height 8px with a transparent track and a
  semi-transparent `--foreground`-derived thumb with **no** `border-radius` - asserted by a CSS
  content test (the rule block exists with these properties).
- **AC-003:** The previously-raw scroll regions route through `ScrollArea`: the settings body
  (`content.tsx`) and the response `TooLargeBody` + JSON-viewer wrapper (`response-pane.tsx`) render
  a `data-slot="scroll-area"` ancestor instead of a bare `overflow-auto` div - asserted by DOM tests.
- **AC-004:** No scrollbar in the app uses rounded corners or the old `bg-border` thumb - i.e. the
  square/no-radius decision holds everywhere (grep-style guard: no `rounded-full` on a scrollbar
  thumb; the `ScrollArea` thumb class is `bg-foreground/*`, not `bg-border`).
- **AC-005:** All quality gates pass unchanged: `npm test` (full Vitest suite), `npm run typecheck`,
  `npm run build`. No regression in the existing sidebar/console scroll tests.

## 5. Test cases

- **TC-001** (DOM, AC-001): render `<ScrollArea>` with overflowing content; the
  `scroll-area-scrollbar` slot has the thin width class (`w-1.5` / `h-1.5`) and **no** `w-2.5`; the
  `scroll-area-thumb` slot has `bg-foreground/20` and **no** `rounded-full` / `bg-border`.
- **TC-002** (DOM, AC-001): the `ScrollArea` root sets `type="hover"` (the Radix data attribute /
  prop is present) - proves auto-hide intent is wired, not left implicit.
- **TC-003** (CSS, AC-002): read `src/index.css`; assert it contains the `::-webkit-scrollbar`
  width `8px`, a `scrollbar-width: thin` declaration, a `--foreground`-derived
  `scrollbar-color` / thumb `background`, and **no** `border-radius` on the thumb rule.
- **TC-004** (DOM, AC-003): render the settings body view; the scrollable container is (or is
  inside) a `data-slot="scroll-area"`, not a bare `div.overflow-auto`.
- **TC-005** (DOM, AC-003): render `TooLargeBody` (a body over the render limit); the preview
  `<pre>` is inside a `data-slot="scroll-area"`.
- **TC-006** (DOM, AC-003): render `ResponseBody` with valid JSON under the limit; the JSON-viewer
  wrapper is a `data-slot="scroll-area"`.
- **TC-007** (guard, AC-004): no rendered scrollbar slot carries `rounded-full` / `rounded-xs` /
  `bg-border`; the thumb uses `bg-foreground/*`.
- **TC-008** (gates, AC-005): `npm test`, `npm run typecheck`, `npm run build` all pass.

## 6. Edge cases

- **Double scrollbar inside `ScrollArea`:** the global `::-webkit-scrollbar` could in theory paint
  over Radix's hidden native bar. It does not - Radix's `[data-radix-scroll-area-viewport]`
  selector out-specifies `*`. Verify in the real webview (no second bar inside the sidebar/console).
- **CodeMirror inner scroller:** the editors (`.cm-scroller`) own their scrolling; they are NOT
  wrapped in `ScrollArea` (CM manages its own viewport). They get the thin look from the global CSS
  (2.2). Confirm the body editor + response JSON viewer show the thin bar, not a thick OS one.
- **Select / Command popovers:** Radix Select content + cmdk list use internal `overflow-y-auto`;
  they're portalled and can't host a `ScrollArea` cleanly. Covered by global CSS. Confirm a long
  Select/palette list shows the thin bar.
- **Light vs dark contrast:** `bg-foreground/20` is light-on-dark / dark-on-light. Check the thumb
  is visible (not invisible) in both themes; bump opacity if it disappears.
- **Horizontal overflow (tab strip):** stays on the global CSS bar (not wrapped, dnd risk). Confirm
  the horizontal bar is thin and unobtrusive when many tabs overflow.
- **Auto-hide fl/jsdom:** Radix `type="hover"` visibility is driven by pointer events + a
  `ResizeObserver`; jsdom won't actually toggle visibility. Tests assert the *configuration*
  (classes, `type` prop) and structure (slot presence), not the runtime fade - the fade is verified
  manually in the webview.

## 7. Dependencies

- **No new npm dep, no new Rust crate.** Reuses the existing `radix-ui` `ScrollArea`, Tailwind
  utility classes, and CSS custom properties already in `index.css`.
- **Files touched:** `src/components/ui/scroll-area.tsx`, `src/index.css`,
  `src/components/workspace/content.tsx`, `src/components/workspace/response-pane.tsx`,
  `docs/design.md` (contract note). New test file(s) under the existing test layout.

## 8. Open questions

- None blocking. Thumb shape (square) and approach (ScrollArea + CSS fallback) resolved with the user.
