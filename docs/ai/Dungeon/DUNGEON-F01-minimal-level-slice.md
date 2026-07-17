# DUNGEON-F01 — Minimal level slice (explore ↔ combat, dual level source)

## Meta
- **ID:** DUNGEON-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [COMBAT-F05](../Combat/COMBAT-F05-enemy-data-driven.md), [COMBAT-F06](../Combat/COMBAT-F06-enemy-bt-ai.md), [CHAR-F01](../Characters/CHAR-F01-character-package.md), [CLI-F05](../CLI/CLI-F05-postcombat-inventory-layout.md), [CORE-F08](../Core/CORE-F08-gameplay-ability-framework.md)
- **Gameplay (read-only):** [dungeon.md](../../design/systems/dungeon.md), [core-loop.md](../../design/systems/core-loop.md)

Depends on: COMBAT-F05/F06 Done, CHAR-F01, ITEM-F02, EQUIP-F01, CLI-F03+  
Blocks: multi-level progression, vision, unit pools, exploration BT (F02+)

> **Terminology:** 地牢 **层级** = **`level`** (not `floor`). A **level** is one graph of **rooms**. An **adventure** is one run (may span multiple levels later; F01 = one level).

---

## TL;DR

1. **`@cardgame/dungeon`** — level graph, room state, movement, encounter → combat handoff; **no CLI/DOM**.
2. **Dual level source:** wire **JSON** (stable tests) + **seeded generator** (正式玩法); same in-memory `LevelAsset`.
3. **Unified room model:** exploration and **BattleOnly** both use **rooms** — BattleOnly = **virtual single-room level** (encounter → combat → room loot on ground).
4. **Movement:** GA-based (`ga.dungeon.move`); **movement cost API** present, F01 **cost = 0** everywhere.
5. **Cross-combat persist:** player **Health** (and loadout/inventory); **post-combat** clears combat meta attrs + combat-scoped GEs.
6. **CLI explore layout:** Enemies pane → **map**; Hand pane → **room contents** (ground loot, interactables); loot pickup in **explore**, not post-combat overlay.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | **Level** names 层级; type/id prefix `level.*` | User 2026-07-17 |
| D2 | Level from **JSON** (tests) **or** **generator** (gameplay) | User |
| D3 | F01 generator: **connected normal rooms only** — no BOSS distance, pools, vision | User |
| D4 | **BattleOnly** = virtual **single-room level** (encounter → enter combat → end → room loot) | User |
| D5 | Movement via **GA**; cost parameter wired, **F01 always 0** | User |
| D6 | Persist **Health** (+ existing equip/bag); clear **meta attrs + combat GEs** after fight | User |
| D7 | Explore UI: **map** + **room panel**; pickup loot in explore | User |
| D8 | **AdventureSession** owns **one player GFC** for the run; combat is a **sub-phase** (enemy spawn/despawn) | Partner |
| D9 | Encounter uses **`spawnEnemyFromRepo(characterId)`** | Partner |
| D10 | Agent API: `legalActions[]` on explore phase | Partner |
| D11 | Entering uncleared encounter room: **pause for confirm** (`ConfirmCombat`) — not auto-enter | User 2026-07-17 |

---

## Scope

### In (F01)

- `packages/dungeon/` — level loader, minimal generator, `AdventureSession`
- Wire JSON: `data/dungeon-levels/level.probe.json`
- Generator profile: connected grid/graph, random room wiring, optional encounter table
- Virtual level for BattleOnly (`level.battle_only` or runtime-built single room)
- Combat sub-phase: enter / exit, HP carry, combat cleanup
- Movement GA + zero-cost edges (hook for future AP per [dungeon.md](../../design/systems/dungeon.md))
- Room **ground loot** (`RoomLootPile`) + pickup into existing inventory APIs
- CLI: `dungeon` runtime + explore layout; refactor `battle` to virtual level path
- Tests: JSON level load, generator connectivity, move + encounter + loot flow

### Out (F02+)

- Multi-**level** adventure (stairs, BOSS gate, evac between levels)
- Vision, stealth, unit pools, refresh on **round** end
- Shops, events, rest, friendly NPCs
- Movement cost &gt; 0, corridor fractional cost
- Exploration BT (`dungeon.wander`, etc.)
- Procedural BOSS placement rules, mandatory room types (shop/event quotas)

---

## Architecture

```text
                    ┌─────────────────────────────────────┐
                    │  AdventureSession (packages/dungeon) │
                    │  - RuleEngine + persistent player GFC │
                    │  - current LevelAsset, roomId, phase   │
                    └──────────────┬──────────────────────────┘
                                   │
              phase: explore       │        phase: combat
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
         legalActions: Move, Pickup…      CombatEncounter (wraps CombatSession)
         ga.dungeon.move (cost=0)         spawn enemy GFC only
         room.loot / interactables        on exit: cleanup GE, loot → room
```

### Package boundaries

| Package | Role |
|---------|------|
| `@cardgame/dungeon` | Level/Room model, loader, generator, AdventureSession, explore actions |
| `@cardgame/combat` | CombatSession (no import from dungeon); accepts enemy setup + player gfc ref |
| `@cardgame/cli` | Renders explore vs combat; hosts AdventureSession |

### BattleOnly as virtual level

```text
console:battle orc_brute
  → build virtual LevelAsset { one room, encounter: orc_brute }
  → AdventureSession.start(virtualLevel)
  → phase explore (optional: auto-enter combat on start OR explicit Enter)
  → combat sub-phase
  → phase explore, room.loot = victory drops
  → player picks up from room panel (same as dungeon)
```

Removes separate post-combat loot UI path over time; **CLI-F05 loot-in-Hand pane** becomes **room contents in explore** (Hand slot reused).

---

## Data model

### Layout

```text
data/dungeon-levels/
  level.probe.json          # stable test level
  gen.default.json          # generator profile (optional wire; may live in code F01)
```

### Level wire (JSON)

```json
{
  "id": "level.probe",
  "source": "wire",
  "startRoomId": "start",
  "rooms": [
    {
      "id": "start",
      "kind": "normal",
      "grid": { "x": 0, "y": 0 },
      "exits": { "east": "hall_a" }
    },
    {
      "id": "hall_a",
      "kind": "normal",
      "grid": { "x": 1, "y": 0 },
      "exits": { "west": "start", "east": "exit" },
      "encounter": { "characterId": "slime" }
    },
    {
      "id": "exit",
      "kind": "exit",
      "grid": { "x": 2, "y": 0 },
      "exits": { "west": "hall_a" }
    }
  ]
}
```

| Field | Notes |
|-------|-------|
| `kind` | F01: `normal` \| `exit` \| `safe` (safe = no encounter roll on enter) |
| `encounter` | Optional `{ characterId }` — entering uncleared room triggers combat |
| `exits` | Map direction or label → adjacent `roomId`; movement cost on edge defaults **0** |
| `grid` | Map rendering only (CLI); not required for logic if `exits` complete |

### Generator (F01)

```typescript
type LevelGenProfile = {
  seed: number;
  width: number;   // e.g. 3–5
  height: number;
  roomCount: number;
  encounterTable: { characterId: string; weight: number }[];
  exitRoom: boolean; // one exit room on graph periphery
};
```

Algorithm (minimal):

1. Place `roomCount` cells on grid (random walk or shuffle positions).
2. Connect into **one connected component** (MST or incremental link neighbors).
3. Pick `startRoomId` (wire or first safe cell).
4. Assign encounters from table to subset of normal rooms.
5. Mark one room `kind: exit` if `exitRoom`.

Output: same `LevelAsset` as JSON loader.

### Room runtime state

```typescript
type RoomRuntimeState = {
  cleared: boolean;
  loot: PendingLootEntry[];  // ground pile; reuse items types where possible
  encounterConsumed: boolean;
};
```

---

## Movement (GA)

| Piece | F01 behavior |
|-------|----------------|
| Ability | `ga.dungeon.move` (archetype in `data/abilities/`) |
| Params | `targetRoomId` or `direction` |
| Cost | `SetByCaller.MovementCost` or edge field — **always 0** in F01 |
| Host | AdventureSession validates adjacency + room enter rules, then commits move |

Explore `legalActions` example:

```typescript
{ type: 'Move', direction: 'east' }
{ type: 'ConfirmCombat' }  // when current room has pending encounter (pause after enter)
{ type: 'PickupLoot', index: 0 }
{ type: 'LeaveLevel' }   // on exit room when win condition met
```

**Encounter pacing (D11):** Move into a room with an uncleared `encounter` → stay in `explore` with UI hint (e.g. room panel: "Enemy present — confirm to fight"); player must issue `ConfirmCombat` before combat sub-phase. Makes explore→combat a deliberate beat.

Implementation note: F01 may ship **action API first**, GA activation in same slice or S04 — both must share validation.

---

## Combat sub-phase

### Enter

1. `spawnEnemyFromRepo(encounter.characterId)` (existing).
2. `CombatSession.attach({ engine, playerGfc, enemySetup, ... })` — **do not** destroy/recreate player GFC.
3. `phase = combat`; CLI switches to combat layout.

### Exit (victory)

1. `createPendingLootFromCharacter(...)` → append to **current room** `loot` (not global pending overlay).
2. Mark room `cleared: true`.
3. **Combat cleanup** on player (and dispose enemy):

```text
resetCombatMeta(player)
remove combat-tagged Infinite GEs (e.g. ge.combat.*, card preview scaling)
preserve: Health, MaxHealth, primaries, equipment-granted passives (non-combat scope)
```

4. Destroy enemy entity; `phase = explore`; CLI → map + room panel.

### Exit (defeat)

- Adventure ends (`result: defeat`); F01 no continue.

---

## CLI layout (explore phase)

| Pane (F04 grid) | Combat | Explore |
|-----------------|--------|---------|
| Top-right (Enemies) | Enemy + Intent | **Level map** (current room highlighted, cleared/uncleared) |
| Bottom-left (Hand) | Hand cards | **Room panel** — ground loot list, future interactables |
| Top-left (Player) | Player stats | Unchanged |
| Bottom-right (Log) | Combat log | Explore log |

Input (explore):

- WASD / arrows → `Move`
- Digit / `P` → pickup loot (reuse ITEM pickup helpers)
- `B` → bag (unchanged)
- Enter room with encounter → **confirm beat** (`ConfirmCombat`); do not auto-enter combat

**BattleOnly:** same explore chrome with 1×1 map (or collapsed map + room panel focus).

---

## Implementation slices

| Order | Slice | Deliverable | Status |
|-------|-------|-------------|--------|
| **S01** | Level core | `packages/dungeon` types, JSON loader, `level.probe.json`, tests | Done |
| **S02** | Generator | Connected-room generator + seed reproducibility tests | Done |
| **S03** | AdventureSession | Room graph, move (cost=0), room state, virtual single-room factory | Done |
| **S04** | Combat handoff | Attach/detach CombatSession; HP persist; post-combat GE/meta cleanup | Done |
| **S05** | Room loot | Victory loot → room pile; pickup actions; no global post-combat loot pane | Done (CLI pane = S06) |
| **S06** | CLI explore UI | Map + room panel; `dungeon start`; BattleOnly → virtual level | Done |
| **S07** | Movement GA | `ga.dungeon.move` wire + activate path (or fold into S03 if already action-only) | Done |

Suggested order: S01 → S02 → S03 → S04 → S05 → S06 → S07 (GA can parallel S03 if action API exists).

---

## Acceptance

- [x] JSON level loads; probe test moves start → encounter room → exit
- [x] Generator produces connected graph; same seed → same graph
- [x] BattleOnly runs as 1-room virtual level; combat → loot on ground → pickup in room panel
- [x] Player HP persists across fights in one adventure; meta attrs zeroed after combat
- [x] Explore CLI shows map + room loot; no VICTORY loot overlay blocking explore (banner optional in map pane)
- [x] `npm run verify` green with `dungeon` package tests

---

## Risks

| Risk | Mitigation |
|------|------------|
| CombatSession assumes fresh player bootstrap | Refactor to `attach`/`detach`; AdventureSession owns player |
| CLI-F05 loot UX regression | Single room panel path; update frame-renderer tests |
| Generator scope creep | F01: connectivity only; no dungeon.md pool rules |
| GA movement delays slice | Action API first; GA thin wrapper same sprint |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-07-17 | S07: `ga.dungeon.move` wire + handler; CLI explore uses GA activate path |
| 2026-07-17 | S06: CLI explore Map/Room panes; `dungeon` mode; BattleOnly virtual confirm beat |
| 2026-07-17 | S04–S05: `CombatSession.attach`/`detach`, cleanup, adventure combat bridge + room loot |
| 2026-07-17 | Initial spec: dual source, virtual BattleOnly room, level naming, explore UI, GA move cost=0 |
