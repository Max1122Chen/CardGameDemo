# DUNGEON-F04 — Exploration fog (Civ-style: known layout + door vision)

## Meta
- **ID:** DUNGEON-F04
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-18
- **Related:** [DUNGEON-F02](./DUNGEON-F02-spatial-level-gen.md), [DUNGEON-F03](./DUNGEON-F03-explore-round-ap.md), [dungeon.md](../../design/systems/dungeon.md)
- **Depends on:** DUNGEON-F02 Done

---

## TL;DR

Civilization-style **map reveal**, not MOBA fog:

1. **`known` (开图)** — once a room has ever been in **vision** (seen through a door), its layout stays on the map forever. **Entering is not required.**
2. **`visited`** — rooms physically entered (still tracked; subset of known).
3. **`vision`** — current room ∪ **door-adjacent** rooms → show **interior** (`~`, kind glyphs).
4. **Known + no vision** — draw room shell only (empty floor).
5. Wall-adjacent without a door → neither vision nor auto-reveal.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Layout memory = rooms ever seen in vision (`known`) | User 2026-07-18 |
| D2 | Vision adjacency = door-linked only | User |
| D3 | Known without vision → hide interior, keep layout | User (Civ) |
| D4 | Glimpse through door permanently opens map for that room | User |
| D5 | Closed-door / peek variants deferred | Partner |

---

## Data

```text
knownRoomIds     — permanent layout (ever in vision)
visitedRoomIds   — physically entered
visionRoomIds    — current ∪ door-adjacent
mappedRoomIds    — == knownRoomIds (CLI draw set)
```

---

## 验收

- [x] Door-glimpse without visit → room stays on map after leaving vision
- [x] Wall-only neighbor never auto-revealed
- [x] Interior only while in vision
- [x] `npm run verify` green

---

## 变更记录

| Date | Change |
|------|--------|
| 2026-07-18 | Spec + wall-adjacent then door vision |
| 2026-07-18 | Corrected: known = ever seen (not only visited) |
