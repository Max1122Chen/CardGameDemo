# CLI-F04 — Combat main UI layout and in-pane stats

## Meta
- **ID:** CLI-F04
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CLI-F03](./CLI-F03-host-foundation.md), [CLI-F02](./CLI-F02-terminal-tui.md), [COMBAT-F04](../Combat/COMBAT-F04-combat-numeric-depth.md)

Depends on: CLI-F03 Done  
Blocks: inventory/equipment visual polish (later Feature)

---

## TL;DR

1. **Combat main screen only** — inventory / equipment / console chrome deferred.
2. **Layout:** top = player left / enemies right; bottom = **hand (~65%) | log (~35%)** same row; height = max(hand, min(log, 8)).
3. **Typography:** fields use **`Label:Value`** (colon, **no** space after).
4. **Stats (P/E):** expand **in place** inside the player or enemy pane (no floating stats box).
5. Extract **`Box` / `Field` / two-column** widgets as needed.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Feature **CLI-F04**; combat main UI only | User 2026-07-17 |
| D2 | Field style **`Label:Value`** (colon, no trailing space) | User (revised) |
| D3 | Player left / enemies right (multi-enemy vertical) | User |
| D4 | Stats replace content **inside** the corresponding entity pane | User |
| D5 | Inventory / equipment visual polish **out of scope** | User |
| D6 | Selection: marker + emphasis over full-line inverse where practical | Partner default |
| D7 | Footer: Gameplay-relevant shortcuts only on combat main | Partner default |
| D8 | Narrow terminal (`cols` &lt; 72): stack panes single-column | Partner default |
| D9 | Hand left ~65% / Combat Log right ~remainder; **same row**; height = max(hand, min(log, 8)) | User 2026-07-17 |
| D10 | Enemy stats pane follows selected enemy when navigating | User default |
| D11 | `padVisible` / truncate **preserve ANSI** (no strip-on-clip) | User playtest 2026-07-17 |
| D12 | Adjacent panes use **`renderTwinBoxes`**: one shared vertical divider | User playtest |
| D13 | Adjacent panes **equalize inner content height** before drawing borders | User playtest |
| D14 | Combat log entries **wrap** to pane inner width (ANSI-safe); visible height capped by D15 | User 2026-07-17 |
| D15 | Combat log **max viewport** = 8 rows (ScrollZone + row-height cap); excess stays in buffer + auto-tail | User 2026-07-17 |

---

## Scope

### In

**Layout**
- Combat header (phase / result) full width.
- **Row A:** `[ Player pane | Enemy pane(s) ]` — two columns.
- **Row B:** Hand pane full width.
- **Row C:** Combat log (existing ScrollZone auto-tail) full width.
- Status message lives in player pane or under header (pick one; recommend under header as one muted line).

**Player pane (default)**
- Title: `Player`
- Lines: `HP: …` `Block: …` `AP: …` (colon style)
- Optional preview line (block gain / damage breakdown) when card preview active on self-ish effects
- Status / hint line if not global

**Enemy pane (default)**
- Title: `Enemies` (or `Enemy` if always one for now)
- Each enemy: one or more lines, selected enemy marked; vertical stack
- Per enemy: name, `HP:`, optional `Block:`, `Intent:`, preview `Take:` when relevant

**Hand pane**
- Full width under the two-column row
- Cards listed with cost; selected marker; preview hint on selected card

**In-pane stats mode**
- `statsOverlay === 'player'` → player pane shows expanded stats (primaries + damage pipeline attrs) instead of compact combat row; title may become `Player Stats` or keep `Player` with a muted `(stats)` tag.
- `statsOverlay === 'enemy'` → **selected** enemy’s slot (or the whole enemy column if single enemy) shows that enemy’s expanded stats; other enemies may collapse to one-line summaries or hide detail (recommend: only selected enemy expanded; others stay compact one-liners).
- Esc / toggle off restores compact view (existing `close_stats_overlay` / toggle behavior).
- **Remove** the bottom-of-frame floating stats `box('Player Stats'…)` / `box('Enemy Stats'…)`.

**Widgets / helpers**
- Extract `renderBox` from `frame-renderer` → `widgets/box.ts`
- `formatField(label, value)` → `Label: Value` with theme colors
- `renderTwoColumn(leftLines, rightLines, totalWidth)` — pad columns, align heights with blank lines

**Input**
- Keep P / E / Esc semantics; `IMC_Stats` still owns Esc while stats mode on.
- No new keys required for F04.

### Out

- Inventory / equipment / loot overlay redesign
- Console / settings visual redesign (may still render below; no polish pass)
- SelectList / Dropdown widgets (unless trivially needed)
- Blessed/Ink migration, Unicode heavy frames, animations, multi-theme skins
- Changing combat rules or stats data model

---

## Layout sketch

```text
CardGameDemo [battle] seed=… scenario=…
Phase: PlayerTurn | Turn: player
status hint (optional one line)

+-- Player --------+  +-- Enemies ------------------+
| HP: 30/30        |  | > [0] Slime                 |
| Block: 0         |  |   HP: 12  Block: 0          |
| AP: 3/3          |  |   Intent: Attack 6          |
| …preview…        |  |   Take: 8                   |
+------------------+  |   (more enemies below)      |
                      +-----------------------------+

+-- Hand ------------------------------------------+
| > [1] Strike (cost: 1) => 8 dmg                   |
|   [2] Defend (cost: 1)                            |
+--------------------------------------------------+

+-- Combat Log ------------------------------------+
| … ScrollZone auto-tail …                          |
+--------------------------------------------------+

Space Commit | Esc/x Cancel | F End Turn | P/E Stats | …
```

**Stats mode (player) — same left slot:**

```text
+-- Player --------+  +-- Enemies ------------------+
| HP: 30/30        |  | (compact enemy list)        |
| Block: 0  AP: 3  |  |                             |
| Str: 10  Con: …  |  +-----------------------------+
| … Dex Int Wis Cha|
| Dmg scale/mult/off|
| Esc closes stats |
+------------------+
```

**Stats mode (enemy) — right slot expands selected enemy.**

---

## Typography conventions (v1)

| Pattern | Form | Examples |
|---------|------|----------|
| Field | `Label: Value` | `HP: 30/30`, `Block: 4`, `AP: 3/3`, `Intent: Attack 6` |
| Primary chip | `Label: Value` | `Str: 10` |
| Preview | short suffix ok | `Take: 8`, `=> blk+5` |
| Phase line | may keep `Phase: … \| Turn: …` | already colon |

Unify `formatPlayerStats` / enemy lines / `formatPrimaryStat` to colon+space (today primary uses `Str:10` without space — normalize to `Str: 10`).

---

## Implementation notes

### Files (expected)

```text
packages/cli/src/render/
  widgets/box.ts          # NEW (extract)
  widgets/field.ts        # NEW formatField / formatFieldColored
  widgets/columns.ts      # NEW two-column join
  widgets/scroll-zone.ts  # keep
  theme.ts                # update formatPlayerStats / formatPrimaryStat
  frame-renderer.ts       # combat layout rewrite; drop floating stats boxes
```

### Width policy

- Read `cols` from paint path or pass width into `renderFrame` (today renderFrame is width-agnostic 72).
- Recommend: `renderFrame(state, controller, { cols })` with default 80; column split ~ `floor((cols-3)/2)` each with gap, clamp min pane width ~28; if `cols < 72`, stack Player then Enemies (single column) to avoid unreadable squeeze.

### Tests

- Snapshot or string assertions: two-column markers / pane titles order (Player before Enemies in left-right join; Hand below).
- Stats mode: frame contains expanded primary labels inside player section and **does not** append a separate trailing `Player Stats` box.
- Existing input-router / app-shell tests remain green; update any frame snapshots that assumed stacked single-column boxes.

### Risks

| Risk | Mitigation |
|------|------------|
| Uneven column heights look ragged | Pad shorter column with blank inner lines to match |
| Narrow terminals | D8 stacked fallback |
| Enemy stats for multi-enemy unclear | Expand selected only; document in footer |
| ANSI width in columns | Reuse `padVisible` / `visibleLength` |

**Tech-debt risk:** low–medium (cli render only).

---

## Slices

| Slice | Deliverable |
|-------|-------------|
| **S01** | Widgets: Box, Field, Columns + theme colon helpers |
| **S02** | Combat layout: two-column + hand + log; stacked fallback |
| **S03** | In-pane stats swap; remove floating stats boxes; tests + verify |

---

## Exit criteria

- [x] Combat main: Player | Enemies top; Hand (~65%) | Log bottom (same row, max height)
- [x] Fields use `Label:Value` (no space after colon)
- [x] P/E stats render in-pane; no floating stats box
- [x] Narrow terminal fallback (cols &lt; 72) stacks panes
- [x] Inventory/equipment overlays unchanged (functional)
- [x] Enemy stats follow selected enemy
- [x] ANSI colors preserved under pad/truncate (D11)
- [x] Adjacent panes share one vertical divider (D12)
- [x] Adjacent panes equalize to taller height (D13)
- [x] Combat log wraps to pane width (D14)
- [x] Combat log max viewport 8 rows (D15)
- [x] `npm run verify` green
- [x] Docs Done + Progress

---

## Playtest polish (D11–D15)

| Issue | Fix |
|-------|-----|
| Colors became white | `padVisible` used `stripAnsi` when clipping; now `sliceVisible` keeps SGR codes and resets after truncate |
| Double vertical border between panes | `renderTwinBoxes`: one shared `+`/`\|` instead of joining two full boxes |
| Player/Enemy unequal height | Twin row pads inner lines to `max(left,right)` before drawing top/bottom rules |
| Long log lines clipped | `wrapVisible` / `wrapAllVisible` before ScrollZone; auto-tail on wrapped rows (D14) |
| Log pane grows without bound | Cap viewport / row contribution at `COMBAT_LOG_MAX_VIEWPORT` (8); auto-tail older lines (D15) |

---

## Resolved questions

1. Hand | Log same row (~65%/35%), height = taller — D9.
2. Enemy stats follow selection — yes.
3. Victory/Defeat banner above columns — yes.

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-17 | D14: combat log ANSI-safe auto-wrap to pane width |
| 2026-07-17 | D15: combat log max viewport 8 rows (no unbounded height) |
| 2026-07-17 | Polish D11–D13: ANSI-safe pad, shared divider, equalized twin height |
| 2026-07-17 | Implemented; Done. Hand\|Log row, `Label:Value`, in-pane stats |
| 2026-07-17 | Review draft from user layout + in-pane stats + colon fields |
