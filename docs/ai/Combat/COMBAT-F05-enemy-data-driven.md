# COMBAT-F05 — Data-driven enemies (characters + behavior trees)

## Meta
- **ID:** COMBAT-F05
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [CORE-F14](../Core/CORE-F14-behavior-tree.md), [CHAR-F01](../Characters/CHAR-F01-character-package.md), [COMBAT-F06](./COMBAT-F06-enemy-bt-ai.md), [COMBAT-F04](./COMBAT-F04-combat-numeric-depth.md), [EQUIP-F01](../Equipment/EQUIP-F01-equipment-loadout.md), [CLI-F05](../CLI/CLI-F05-postcombat-inventory-layout.md)
- **Gameplay (read-only):** [character.md](../../design/systems/character.md) §敌人

Depends on: CORE-F14 (BT runtime), CHAR-F01 (`@cardgame/characters`), COMBAT-F04, EQUIP-F01, ITEM-F02  
Blocks: DUNGEON-F01, COMBAT-F06 (smart orc BT)

---

## TL;DR

1. **`@cardgame/characters`** — JSON character defs, spawn instance (loadout + **grid inventory** + deck + `behaviorTreeId`).
2. **Unified AI = behavior trees** ([CORE-F14](../Core/CORE-F14-behavior-tree.md)) — enemy data references `behaviorTreeId`; no parallel script interpreter.
3. **Probe enemies:** **slime** (fixed loop BT) + **orc** (richer deck; **tactical BT deferred to COMBAT-F06**, data + spawn in F05).
4. **Combat:** enemy actions are **only** `combat.playCard` (real hand + AP); Intent mirrors player preview (`Attack N`, `Gain block N`).
5. **Loot:** droppable equipped + **backpack grid** contents; innate gear never drops; fallback `battle-rewards.json`.

**F05 proves:** data spawn + BT-driven fixed turns. **F06 proves:** blackboard + context-aware orc tree.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Enemy AI **unified as behavior tree assets** (`data/behavior-trees/`) | User 2026-07-17 |
| D2 | BT runtime in **`packages/core`** (host-agnostic); combat registers task handlers | User + partner |
| D3 | **`@cardgame/characters`** package for defs + spawn (not combat-owned) | User |
| D4 | `playCard` tasks **consume enemy AP** (real card costs) | User |
| D5 | Enemy `playCard` **target from card** (`self` / `single_enemy`); damage/status → player, block/heal → self | User 2026-07-17 (rev) |
| D6 | **Slime** — low Wis; fixed cycle BT (`Repeat` + `Sequence` of tasks) | User |
| D7 | **Orc** — richer deck + grid loot; **smart BT in COMBAT-F06**; F05 ships data + placeholder/simple tree or stub | User |
| D8 | Spawn **grid inventory + items** on enemies | User |
| D9 | Innate body equipment (`innate: true`); excluded from loot | character.md |
| D10 | Enemy deck = `buildDeckIdsFromLoadout([], loadout, catalog)` | Partner |
| D11 | Single `enemy-1` entity id in F05 | Partner |
| D12 | CLI: intent from **next BT leaf preview**; no enemy hand pane | Partner |
| D13 | No BT editor — JSON only | User |
| D14 | **No off-card actions** — enemies only `combat.playCard` (no `combat.attack` panel damage) | User 2026-07-17 |
| D15 | Enemy **Intent** = card preview labels (`Attack N`, `Gain block N`, card name for status) | User 2026-07-17 |
| D16 | Enemy play **targeting from card def** (`self` block → enemy; `single_enemy` → player) | User 2026-07-17 |

---

## Architecture

```text
data/characters/slime.json ──behaviorTreeId──► data/behavior-trees/bt.slime_cycle.json
data/characters/orc_brute.json ──────────────► data/behavior-trees/bt.orc_stub.json (F05) → bt.orc_tactical.json (F06)

@cardgame/characters
  loadCharacterCatalog / spawnCharacterInstance
        ↓ CharacterInstance { loadout, inventory, deckIds, behaviorTreeId, ... }

@cardgame/core (CORE-F14)
  loadBehaviorTree / tickNode / Blackboard / TaskRegistry (no combat imports)

@cardgame/combat
  CombatSession.bootstrap({ player..., enemy: CharacterInstance })
  EnemyTurnDriver:
    1. fillBlackboard(instance, session snapshot)
    2. tick BT until turn step completes (AP spent or wait/end)
  registerTask('combat.playCard' | 'combat.wait' | 'combat.endTurn')
```

### Why behavior trees (agreed direction)

| Benefit | Notes |
|---------|-------|
| One asset format | Slime loop = `Repeat(Sequence(tasks))`; orc = `Selector(conditions, tasks)` — same loader |
| Core/host split | Like GFC: core ticks; combat executes `combat.*` tasks |
| Dungeon later | Exploration AI registers `dungeon.*` tasks on same runtime |
| Testability | Core BT tests with mock registry; combat tests with real tasks |
| Wisdom | F06: combat adapter writes `wisdom` to blackboard; selector weights or extra branches — **not** a second AI system |

### What we avoid

- **No** `ScriptAiController` parallel to BT — delete `enemy-script.ts` path after migration.
- **No** combat logic inside core BT (no `if (cardId === 'strike')` in core).
- **No** per-enemy TypeScript AI classes.

### Orc split (F05 vs F06)

| | F05 | F06 |
|---|-----|-----|
| `orc_brute.json` | yes — stats, equipment, inventory, deck | — |
| `bt.orc_*` | minimal tree (e.g. `playCard` strike if AP else attack) **or** repeat first legal play | full tactical `Selector` + blackboard |
| Validates | spawn, AP, loot from grid | battlefield + hand awareness |

---

## Data model

### Layout

```text
data/characters/
  slime.json
  orc_brute.json
data/behavior-trees/
  bt.slime_cycle.json
  bt.orc_stub.json          # F05
  bt.orc_tactical.json      # F06
data/items/
  slime_body.json           # innate
  orc_axe.json, orc_armor.json, ...
```

### Character definition (wire)

```json
{
  "id": "slime",
  "name": "Slime",
  "maxHealth": 24,
  "maxActionPoints": 3,
  "primaries": { "strength": 8, "constitution": 10, "dexterity": 6, "intelligence": 4, "wisdom": 4, "charisma": 4 },
  "behaviorTreeId": "bt.slime_cycle",
  "equipment": [{ "itemId": "slime_body", "slot": "Chest" }],
  "inventory": [],
  "loot": { "entries": [{ "itemId": "gold_coin", "quantityMin": 2, "quantityMax": 5 }] }
}
```

```json
{
  "id": "orc_brute",
  "name": "Orc Brute",
  "maxHealth": 40,
  "maxActionPoints": 3,
  "primaries": { "strength": 14, "constitution": 12, "dexterity": 8, "intelligence": 6, "wisdom": 9, "charisma": 5 },
  "behaviorTreeId": "bt.orc_stub",
  "equipment": [
    { "itemId": "orc_axe", "slot": "Hand.Main" },
    { "itemId": "orc_armor", "slot": "Chest" }
  ],
  "inventory": [
    { "itemId": "healing_herb", "x": 0, "y": 0 },
    { "itemId": "gold_coin", "x": 1, "y": 0 }
  ],
  "loot": { "entries": [] }
}
```

| Field | Notes |
|-------|-------|
| `behaviorTreeId` | Required; points to BT asset |
| `maxActionPoints` | Enemy turn AP pool |
| `equipment` / `inventory` | Spawn-time; grid same as player (ITEM-F02) |
| `loot` | Extra rolled drops; **plus** droppable equipped + bag on defeat |

### Slime BT asset

```json
{
  "id": "bt.slime_cycle",
  "root": {
    "type": "Repeat",
    "child": {
      "type": "Sequence",
      "children": [
        { "type": "Task", "actionId": "combat.playCard", "params": { "cardId": "defend" } },
        { "type": "Task", "actionId": "combat.playCard", "params": { "cardId": "weaken" } },
        { "type": "Task", "actionId": "combat.playCard", "params": { "cardId": "strike" } }
      ]
    }
  }
}
```

### Combat task contract (host)

| actionId | Params | Behavior |
|----------|--------|----------|
| `combat.playCard` | `cardId` | Play from enemy hand if legal; **deduct card AP**; target from card (`self` / `single_enemy`) |
| `combat.wait` | — | End step successfully |
| `combat.endTurn` | — | Force end enemy turn |

**Removed:** `combat.attack` (off-card panel damage). All enemy effects come from deck cards.

**Intent (CLI):** preview next `playCard` like player — `Attack N`, `Gain block N`, or card name for status/heal.

If `playCard` fails (no AP / card not in hand): task returns `Failure` → Selector parent may try sibling (orc F06); Sequence slime assumes valid data.

---

## Implementation slices (after approval)

| Order | Feature / Slice | Deliverable |
|-------|-----------------|-------------|
| 1 | **CORE-F14-S01–S02** | BT loader + composites + tests |
| 2 | **CHAR-F01-S01** | `packages/characters` + spawn + slime/orc JSON |
| 3 | **COMBAT-F05-S01** | `innate` fragment; item defs; loot skips innate |
| 4 | **COMBAT-F05-S02** | CombatSession enemy deck/hand/AP; remove hardcoded Slime |
| 5 | **COMBAT-F05-S03** | Combat BT task registry + slime cycle integration |
| 6 | **COMBAT-F05-S04** | Victory loot from instance (equip + grid); CLI hook |
| 7 | **COMBAT-F05-S05** | Orc spawn + stub BT; verify green |
| — | **COMBAT-F06** | `bt.orc_tactical` + blackboard + Wisdom-weighted decisions |

---

## Out of scope (F05)

- BT visual editor
- Smart orc tactical AI (F06)
- Enemy hand UI
- Enemy backpack item use in combat
- Multi-enemy
- Equipment inspection fog
- Dungeon / exploration BT tasks

---

## Acceptance (COMBAT-F05 Done)

- [x] CORE-F14 + CHAR-F01 integrated
- [x] Slime + orc spawn from JSON with loadout + grid
- [x] Slime turn driven by `bt.slime_cycle`
- [x] `playCard` spends AP; targeting from card def
- [x] No off-card `combat.attack`; Intent uses preview-style labels
- [x] `createSlimeScript` / `enemyAttackDamage` removed from production path
- [x] Loot: innate excluded; bag + droppable gear included
- [x] `npm run verify` green

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | User: cards-only enemy actions; preview-style Intent; slime defend cycle |
| 2026-07-17 | Implemented: BT enemy turns, character spawn, instance loot, CLI `battle orc_brute` |
| 2026-07-17 | Initial spec (Review) |
| 2026-07-17 | User: BT unified AI, characters pkg, AP play, orc+grid, F06 for smart AI |
| 2026-07-17 | User confirm: play costs AP; target player; BT in core; orc + enemy grid |

---

## Resolved (user 2026-07-17)

| # | Question | Answer |
|---|----------|--------|
| 1 | Enemy AP for play | **Yes** — real card cost |
| 2 | Target | **Player** fixed |
| 3 | Package | **`@cardgame/characters`** now |
| 4 | Slice order | F05 fixed BT; **F06** context-aware orc |
| 5 | Second enemy | **Orc** + richer deck |
| 6 | Enemy backpack | **Grid + items** at spawn |
| 7 | AI model | **Unified BT assets** (CORE-F14); no script interpreter |

