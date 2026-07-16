# CLI-F03 — Enhanced input foundation, paint reliability, and TUI widgets

## Meta
- **ID:** CLI-F03
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CLI-F02](./CLI-F02-terminal-tui.md), [EQUIP-F01](../Equipment/EQUIP-F01-equipment-loadout.md)
- **Reference (external):** minEngine `Runtime/Function/Input` (simplified UE Enhanced Input)

Depends on: CLI-F02 Done  
Blocks: comfortable growth of overlays / dungeon / richer console (not a hard gate on EQUIP-F02 / COMBAT-F05)

---

## TL;DR

1. **Input:** Replace ad-hoc `routeInput` char switches with minEngine-style **InputAction + InputMappingContext** (priority stack + consume). Keep CLI-sized — digital / char actions, not full axis/modifier universe.
2. **Paint:** Fix frame ghosting via a **fixed terminal framebuffer** (pad to cols×rows, reliable erase), not “hope overwrite covers everything”.
3. **Widgets:** **ScrollZone** with **sticky auto-tail** (default) for combat/console logs; SelectList deferred if unused this round.
4. **Visual layout polish:** deferred to a follow-up discussion after this Feature lands.
5. **Non-goals this Feature:** rebind UI, mouse, full theme overhaul, ink/blessed migration, CLI-F01 ndjson completion.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | One Feature CLI-F03, slices S01–S03 | Spec |
| D2 | IA + IMC + priority + consume; no Axis2D/mouse | Spec + user |
| D3 | Active IMC from overlay/focus stack | Spec |
| D4 | Bindings in TS modules | Spec |
| D5 | Fixed-size cell buffer paint | Spec |
| D6 | ScrollZone first; SelectList optional/defer | User 2026-07-17 |
| D7 | Typography/layout pass **deferred** after this round | User 2026-07-17 |
| D8 | cli-only input; bridge to existing UiAction | Spec |
| D9 | ScrollZone **sticky auto-tail** by default | User 2026-07-17 |

---

## Scope

### In

**S01 — Paint reliability**
- Terminal size probe (`columns`/`rows`, sensible fallbacks e.g. 80×24).
- Frame composer fills a `string[]` of exactly `rows` lines, each padded to `cols` (ANSI-aware width).
- `paintFrame` writes home + full buffer (optional trailing erase); tests for shorter→longer→shorter content.

**S02 — Enhanced input (CLI)**
- Types: `InputAction` (name, value kind: `digital` | `axis1` | `char`), `consume` flag.
- `InputMappingContext`: list of `{ action, keyMatch }` (+ optional trigger: Pressed default).
- `InputSystem` (cli-local): ordered active contexts; resolve one key event → triggered actions (highest priority first; consume stops lower contexts).
- Ship contexts: `IMC_Gameplay`, `IMC_Inventory`, `IMC_Console`, `IMC_Stats` (or fold stats into modal), `IMC_Global` (quit / always-available close).
- Bridge: action ids → existing `UiAction` (keep session-controller stable).
- Migrate current router behavior 1:1 (regression tests from `input-router.test.ts`).
- Console IMC: maps printable → `IA_ConsoleChar` / backspace / submit; **consumes** so Gameplay/Inventory never see `b`/`q`.

**S03 — Widgets + light layout pass**
- `ScrollZone`: viewport height, scroll offset, clamp; keys `IA_ScrollUp/Down` when focused (or auto-tail mode for combat log).
- `SelectList`: items, cursor, optional open/closed for dropdown-like UX (inventory focus tabs can stay Tab for now).
- Refactor combat log + console scrollback onto ScrollZone.
- Apply D7 to gameplay HUD / stats overlay / inventory labels in touched render paths (not a full redesign).

### Out

- Full UE trigger matrix (Hold, Pulse, Chord chords beyond simple Pressed).
- Runtime remapping UI / save bindings.
- Mouse, paste buffering polish, IME.
- Blessed/Ink/React TUI rewrite.
- Pixel-perfect “pretty” theme; large animation.
- Completing CLI-F01 ndjson host logging (remains Planned parallel).

---

## Architecture

```text
stdin bytes
  → key-events.parse
  → InputSystem.resolve(activeIMCs, ParsedKey)
  → InputAction[] (ordered, consumed)
  → mapActionsToUiActions(...)
  → applyUiActions / session-controller   (unchanged ownership)

AppState + SessionController
  → widgets compose panes (ScrollZone, SelectList, box)
  → FrameBuffer(cols, rows)
  → terminal-io.paint
```

### Package layout (proposed)

```text
packages/cli/src/
  input/
    key-events.ts          # keep
    input-action.ts        # IA defs
    input-mapping.ts       # IMC + mapping entries
    input-system.ts        # priority resolve + consume
    bindings/              # gameplay.ts, inventory.ts, console.ts
    to-ui-actions.ts       # IA → UiAction
  render/
    ansi.ts / theme.ts     # keep; extend pad helpers
    frame-buffer.ts        # NEW fixed buffer
    widgets/
      box.ts               # extract from frame-renderer
      scroll-zone.ts
      select-list.ts
      field.ts             # formatLabelValue helpers (D7)
    frame-renderer.ts      # compose only
```

### minEngine mapping (what we copy vs cut)

| minEngine | CLI-F03 |
|-----------|---------|
| InputAction + value type | Yes (`digital` / `char`; axis1 optional for scroll) |
| InputMappingContext + key mappings | Yes |
| Priority active contexts | Yes |
| Consume input | Yes (`bConsumeInput`) |
| InputComponent bind callbacks | Thin: map to `UiAction` instead of component bus |
| Triggers (Down/Pressed/Released) | **Pressed only** (+ optional Repeat later) |
| Modifiers (Negate, DeadZone, …) | **Out** |
| Axis2D / mouse | **Out** |

### IMC sketch (illustrative)

```text
Priority high → low when stacked:

[Console open]
  IMC_Console   (consume all chars except Esc/` close)
  IMC_Global

[Inventory open]
  IMC_Inventory
  IMC_Global

[Gameplay]
  IMC_Gameplay
  IMC_Global
```

`IMC_Global`: Quit, ToggleConsole, ToggleInventory (when not in Console), Esc close-top.

Exact key tables migrate from current router; Review may tweak conflicts (e.g. inventory `E` equip vs gameplay stats `E` — already focus-gated; IMC makes that structural).

---

## Typography / layout conventions (v1)

| Pattern | Use | Example |
|---------|-----|---------|
| `Label Value` | Compact HUD chips | `HP 30/30` `AP 3/3` `BLK 4` |
| `Label: Value` | Sentence-like / debug lines | `Phase: PlayerTurn` |
| `key=value` | Machine-ish breakdown only | keep damage formula line as-is or `dmg panel=…` later |

Status bar: shorter verbs; help keys grouped once at bottom.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Big-bang router rewrite breaks play | S02 = behavior-preserving migrate + existing tests first |
| Full buffer flicker on Windows Terminal | Prefer pad-overwrite; A/B `clearScreen` only behind debug flag |
| Widget abstraction overgrowth | Only ScrollZone + SelectList + field helper in F03 |
| Scope creep into “make it pretty” | Layout/typo pass limited to touched panes; no new color system |

**Tech-debt risk:** medium — host refactor; contained in `packages/cli`.

---

## Slices

| Slice | Deliverable | Exit |
|-------|-------------|------|
| **S01** | FrameBuffer + paint path | No ghosting when toggling overlay / shorter combat log; unit tests |
| **S02** | InputSystem + IMC bindings + UiAction bridge | All former router tests green; console typing does not toggle bag |
| **S03** | ScrollZone auto-tail on logs; SelectList + D7 deferred | Combat/console/trace use ScrollZone |

Recommended implement order: **S01 → S02 → S03** (paint first for playtest comfort; input next; widgets last).

---

## Exit criteria (Feature Done)

- [x] Ghosting mitigated via fixed framebuffer (manual confirm recommended)
- [x] `routeInput` is thin IMC→UiAction facade (no god-switch char table)
- [x] Console / Inventory / Gameplay conflicts via IMC priority + consume
- [x] Combat log, console scrollback, trace use ScrollZone (auto-tail)
- [x] Label/value convention deferred (D7) — follow-up discussion
- [x] `npm run verify` green
- [x] Progress log + ACTIVE_WORK updated

---

## Resolved questions

1. **Scroll:** sticky auto-tail (D9).
2. **SelectList:** deferred this round.
3. **Stats:** own `IMC_Stats` above Gameplay for Esc.
4. **Visual polish:** deferred after this Feature.

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-17 | Implemented S01–S03 (ScrollZone only); Done; SelectList/typography deferred |
| 2026-07-16 | Review draft: input IMC/IA, framebuffer, ScrollZone/SelectList, typography v1 |
