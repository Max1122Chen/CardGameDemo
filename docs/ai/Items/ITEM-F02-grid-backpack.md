# ITEM-F02 — Rectangular grid backpack

## Meta
- **ID:** ITEM-F02
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [ITEM-F01](./ITEM-F01-item-foundation.md), [CLI-F02](../CLI/CLI-F02-terminal-tui.md)
- **Gameplay (read-only):** [items.md](../../design/systems/items.md)

Depends on: ITEM-F01 Done  
Blocks: EQUIP-F01 (equipment size in bag), DUNGEON-F01 (loot packing pressure)

---

## TL;DR

Upgrade the 12-slot list inventory to a **4×6 rectangular grid backpack**:

1. Items declare rectangular footprint via `inventory_shape` fragment (default `1×1`).
2. Placement: **auto first-fit**, **manual place** (anchor + rotation), **move**, **one-click tidy**.
3. Origin `(0,0)` = top-left; reject illegal placements with a clear message.
4. **No irregular shapes. No mass/weight this Feature.**

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Occupancy = **axis-aligned rectangles only**; no irregular masks forever for this game | User 2026-07-16 |
| D2 | **Mass / weight deferred** — not in ITEM-F02 | User |
| D3 | Default backpack size **`width=4`, `height=6`** (24 cells); origin top-left `(0,0)` | User |
| D4 | Auto place = scan grid for first valid `(x,y,rotation)` (first-fit) | User |
| D5 | Manual place = player supplies **anchor tile** `(x,y)` + **rotation**; server validates; fail → reject message | User |
| D6 | Move selected bag item = remove + place at new anchor/rotation (same validation) | User |
| D7 | One-click tidy = **good packing heuristic**, not proven optimal densest packing | User |
| D8 | Stackable items: one stack occupies **one footprint** (quantity does not grow footprint) | Partner (ITEM-F01 continuity) |
| D9 | Rotation allowed: **0° and 90°** (swap width/height); 180/270 redundant for rectangles | Partner |

---

## Data model

### Fragment

```json
{
  "kind": "inventory_shape",
  "width": 2,
  "height": 3
}
```

| Field | Rule |
|-------|------|
| Missing fragment | Default `width=1`, `height=1` |
| `width` / `height` | Positive integers |
| Mass | Out of scope |

### Placed entry

```text
PlacedEntry {
  entryId: string
  stack | instance   // same as ITEM-F01
  x: number          // anchor column
  y: number          // anchor row
  rotation: 0 | 90   // degrees; 90 swaps effective W/H
}
```

### Container

```text
GridInventory {
  width: 4
  height: 6
  entries: PlacedEntry[]
  // occupancy derived: cells[y][x] -> entryId | empty
}
```

Effective size after rotation:

- `rot=0` → `(w, h)`
- `rot=90` → `(h, w)`

Place is valid iff rectangle `[x, x+ew) × [y, y+eh)` is fully inside the grid and all cells are free (or owned by the same entry when moving).

---

## Operations

| API | Behavior |
|-----|----------|
| `canPlace(entry, x, y, rot)` | Bounds + collision check |
| `autoPlace(entry)` | Scan `y` then `x`, try `rot` in `{0,90}`; first hit wins |
| `place(entry, x, y, rot)` | Validate or reject with reason |
| `move(entryId, x, y, rot)` | Treat self-occupied cells as free for the move |
| `remove(entryId)` / discard | Free cells |
| `tidy()` | Heuristic repack (see below) |

**Reject reasons (examples):** `out_of_bounds`, `collision`, `unknown_entry`.

---

## One-click tidy (heuristic)

**Goal:** denser / tidier layout; **not** optimal bin packing.

**Recommended v1 algorithm — First-Fit Decreasing (FFD) + rotation:**

1. Snapshot all entries (identity + itemId + quantity/instance state preserved).
2. Clear the grid.
3. Sort entries by:
   - effective area descending (`w*h`)
   - then max(side) descending
   - then itemId / entryId for stability
4. For each entry, run `autoPlace` trying rotations `{0, 90}` (prefer the orientation that fits earlier / uses less fragmentation — simple rule: try both, pick first successful scan order).
5. If any entry fails to place after tidy (should be rare if grid capacity ≥ total area), **abort tidy and restore snapshot**; report failure.

**Why this:** deterministic, easy to test, usually packs better than insertion order, matches “较好密堆积” expectation without ILP/solver complexity.

**Out of tidy v1:** skyline packing, genetic search, player-defined sort keys.

---

## CLI UX (proposal)

Inventory overlay shows ASCII grid + entry list.

| Input | Action |
|-------|--------|
| Auto pickup | existing loot pickup → `autoPlace` |
| Select bag item | ↑/↓ or click list / grid marker |
| Manual place / move | enter `x y [r]` (e.g. `1 2 90`) then confirm |
| `T` | tidy |
| `D` | discard selected (whole footprint) |
| Esc | close |

Exact key bindings can be tuned during implementation; validation messages stay in `statusMessage`.

---

## Migration from ITEM-F01

- Replace slot-array inventory with `GridInventory`.
- On bootstrap / load: existing probe items get footprints (coins `1×1`, sword e.g. `1×3` or `2×2` — pick in impl).
- Pending loot unchanged; only placement rules change.

---

## Non-goals

- Irregular shapes / masks
- Mass / encumbrance
- Drag-and-drop GUI
- Stash / warehouse multi-containers
- Optimal packing proofs

---

## Exit criteria

- [x] `inventory_shape` parse + default 1×1
- [x] 4×6 grid place / auto / move / discard
- [x] Manual place rejects with clear reason
- [x] Tidy FFD+rotation; restores on failure
- [x] CLI grid view + controls
- [x] Tests + `npm run verify` green

---

## Probe footprints

| Item | Shape |
|------|-------|
| gold_coin | 1×1 |
| healing_herb | 1×1 |
| iron_sword | 1×3 |
| scrap_metal | 2×1 |
