# CLI-F02 — Terminal gameplay UI shell

Status: Done  
Feature ID: CLI-F02  
Updated: 2026-07-13

---

## Scope

Implement a terminal-first gameplay host in `@cardgame/cli`.

Goals:

- The game is played inside a terminal UI (TUI), not only via one-shot CLI commands.
- Keyboard input is immediate; gameplay input must not wait for Enter.
- Global shortcuts are available from the shell:
  - `Esc` opens/closes settings
  - `b` opens/closes inventory
  - `` ` `` / `~` opens/closes debug console
- Debug console is an in-game overlay, not a separate app.

Out of scope for this slice:

- Full adventure mode
- Persistent settings storage
- Rich inventory semantics
- Complete battle rules

---

## Architecture

- `packages/cli` owns raw terminal input, screen rendering, overlays, and lifecycle.
- `packages/core` remains pure simulation logic.
- The TUI host is a long-lived app shell with:
  - input router
  - renderer
  - overlay stack / focus model
  - session controller

---

## First playable shell

The first shell only needs to prove:

1. Raw keypress input works safely in terminal.
2. UI redraw happens immediately after key-driven state changes.
3. Overlays can open/close predictably with the agreed shortcuts.
4. Console overlay supports text entry with Enter submission.
5. Trace-only mode still works for automation.

---

## Runtime modes

- `trace` / `trace-only`: current non-interactive ndjson path
- `battle`: gameplay TUI shell
- `debug`: gameplay TUI shell with console/trace visible by default

---

## Validation

- Parser tests for mode/flag selection
- Input routing tests for shortcut behavior
- Renderer snapshot tests for shell and overlays
- Manual check: no-Enter gameplay response, overlay toggles, console text submission
