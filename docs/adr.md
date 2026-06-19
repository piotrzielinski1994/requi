# Architectural Decisions — requi

Append-only log of architectural and design decisions made during development.

## Format

Each entry follows this structure:

| Date | Decision | Rationale |
|------|----------|-----------|
| {YYYY-MM-DD} | {What was decided} | {Why this choice was made} |

## Decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-18 | Desktop shell via Tauri (not Electron) | Smaller bundle, native webview, Rust backend; core platform choice, expensive to swap |
| 2026-06-18 | Adopt TanStack ecosystem (Router/Query/Table/Form) | Single coherent stack; permeates whole frontend architecture |
| 2026-06-18 | Keybindings via @tanstack/hotkeys despite alpha status | Official TanStack lib chosen over stable react-hotkeys-hook; alpha = API-churn risk, isolated behind command-palette component |
| 2026-06-19 | Workspace on-disk format = directory-tree mirror (folder=dir, request=`*.req.json`, per-folder `folder.json`, `requi.workspace.json` manifest) | Git-friendly and diffable, scales to large collections, matches the file-based ethos (Bruno-like). It is the public file contract - costly to reverse once users have workspaces on disk. Alternatives (single JSON file; file + sidecar) lost on diffability/scale |
| 2026-06-19 | Config inheritance model: each folder/request carries an optional `ConfigScope`; a request resolves by folding root->leaf, child overrides parent (per-key merge for variables/headers/params, nearest-defined-wins for auth/scripts/timeout), `undefined`/`{inherit}` = inherit, every resolved value keeps provenance | Core semantic contract of the product; whole-object-vs-field-merge for auth was genuinely debated (chose nearest whole-object). Provenance idea borrowed from the pricing archetype's `ComponentBreakdown`; full archetype machinery rejected as overkill |
