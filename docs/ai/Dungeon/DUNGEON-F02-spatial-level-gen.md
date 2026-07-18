# DUNGEON-F02 — Spatial level gen (rect rooms, doors, cell position)

## Meta
- **ID:** DUNGEON-F02
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [DUNGEON-F01](./DUNGEON-F01-minimal-level-slice.md), [dungeon.md](../../design/systems/dungeon.md)
- **Blocks:** DUNGEON-F03 (explore round / AP), F04 (fog), F05 (multi-level)

Depends on: DUNGEON-F01 Done

---

## TL;DR

1. Upgrade level model from **1 cell = 1 room** to **rectangular rooms on a cell grid** with **doors** (adjacent ≠ connected).
2. Player stands on a **cell**; intra-room moves cost **0**; crossing a door uses edge cost (**1** in F02; AP pool in F03).
3. Seeded generator places mixed rect sizes + selective doors + monster pool encounters (fixed in room).
4. CLI map renders walls / doors / player / encounters.
5. **Lifecycle bus stubs** emit enter/leave level, enter/end combat (round/dungeon hooks reserved).

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Discrete cell grid; room = axis-aligned rect | Plan 2026-07-18 |
| D2 | Door = bidirectional link between adjacent cells of different rooms | Plan |
| D3 | Intra-room move cost 0; door edge cost 1 (F02); no AP pool yet | Plan / F03 |
| D4 | Rectangles only (1×1, corridors, larger); no L/T shapes | User |
| D5 | Monsters from weighted pool, fixed in room, no patrol AI | User |
| D6 | Start room safe; at least one exit room | Plan |
| D7 | Lifecycle emit stubs in `@cardgame/dungeon` (not narrative game-events) | Plan |
| D8 | Wire JSON: support `rect` + `doors`; legacy `grid`+`exits` normalized to cells/doors | Partner |

---

## Scope

### In

- Types: `CellCoord`, `RoomRect`, `LevelDoor`, occupancy, `startPosition`
- `normalizeLevel` / parse upgrades; F01 wire still loads
- Spatial `generateLevel` (replace F01 walk-all-adjacent)
- `AdventureSession` cell position + move semantics
- CLI `explore-map` cell/wall/door rendering
- Lifecycle bus + emit on level enter/leave, combat enter/end
- Tests: seed stability, door ≠ adjacency, intra-room free move, map glyphs

### Out

- Explore round / AP spend (F03)
- Fog of exploration (F04)
- Multi-level adventure (F05)
- Unit pool refresh, shops, events, BOSS distance, patrol AI, L/T rooms

---

## Data model

```text
LevelAsset
  rooms[id].rect { x, y, w, h }
  doors[] { a: Cell, b: Cell, cost }
  occupancy: cellKey → roomId   (derived or stored)
  startRoomId, startPosition
Player: position { x, y }; currentRoomId = occupancy[position]
```

Move toward neighbor cell:

- same room → ok, cost 0
- door between cells → ok, cost = door.cost
- else → illegal (wall)

---

## Generator (sketch)

1. Seeded RNG (Mulberry32).
2. Place start 1×1 (or small) safe room.
3. Grow: attach new rects (biased to 1×1, some 1×N / N×1 / 2×2…) without overlap.
4. On attach, carve **one** door on shared wall (keeps graph connected).
5. Optionally place filler rects that share walls **without** doors (adjacent ≠ connected).
6. Mark farthest (by door-graph distance) as exit.
7. Weighted encounters on normal rooms.

---

## Lifecycle stubs

| Event | When |
|-------|------|
| `EnterLevel` | AdventureSession.start |
| `LeaveLevel` | LeaveLevel success |
| `EnterCombat` | ConfirmCombat |
| `EndCombat` | resolve victory/defeat |
| `RoundStart` / `RoundEnd` | reserved (F03) |
| `EnterDungeon` / `LeaveDungeon` | reserved (F05) |

---

## Slices

| Order | Slice | Deliverable | Status |
|-------|-------|-------------|--------|
| **S01** | Model + normalize + parse | rect/doors/occupancy; legacy wire | Done |
| **S02** | Spatial generator + tests | seed-stable; mixed rects; selective doors | Done |
| **S03** | AdventureSession cell move | intra 0 / door cost; lifecycle emits | Done |
| **S04** | CLI map + dungeon uses generator | wall/door/@/! glyphs; `dungeon` mode gen | Done |

---

## 验收

- [x] Same seed → identical `LevelAsset`
- [x] Some spatially adjacent rooms share no door
- [x] Intra-room WASD cost 0; door crossing reports cost 1
- [x] CLI map distinguishable walls vs doors
- [x] Lifecycle listeners receive EnterLevel / EnterCombat / EndCombat / LeaveLevel
- [x] `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Spec created from roadmap plan |
| 2026-07-18 | Implemented S01–S04; mark Done |
