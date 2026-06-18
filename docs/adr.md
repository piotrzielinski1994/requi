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
| 2026-06-18 | React hook from `@tanstack/react-hotkeys` (not core `@tanstack/hotkeys`) | Core `@tanstack/hotkeys` is framework-agnostic with no `useHotkey`; the React adapter package provides the hook + `HotkeysProvider`. Implements the prior ADR's intent. |
| 2026-06-18 | App-wide QueryClient `retry: false` | Queries are local Tauri IPC calls, not flaky network; retry-with-backoff only delays surfacing real errors. |
