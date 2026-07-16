# ITEM-F01 — Item foundation (definitions, inventory, battle loot)

## Meta
- **ID:** ITEM-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md), [COMBAT-F04](../Combat/COMBAT-F04-combat-numeric-depth.md), [CLI-F02](../CLI/CLI-F02-terminal-tui.md)
- **Gameplay (read-only):** [items.md](../../design/systems/items.md), [equipment-and-cards.md](../../design/systems/equipment-and-cards.md)

Depends on: CORE-F02 (tags), DATA-F01 pattern  
Blocks: EQUIP-F01, DUNGEON-F01

---

## TL;DR

1. **ItemDefinition** — tags for classification; `maxStack === 1` means non-stackable; **`sellValue` on every item** (base field).
2. **Fragments** — capability blocks via `fragments[]` discriminated union; **do not over-split** (equipment + granted cards merged).
3. **Inventory** — 12 slot-count backpack; stack vs instance records.
4. **Loot** — static `data/combat/battle-rewards.json` on victory; **status hint** (not auto overlay); pickup/discard via `B` inventory overlay.

**Non-goals:** equip slots, card injection, durability loss, consumable use, 2D grid/weight, shop/dungeon meta.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Classification via **GameplayTags** (`Item.Category.*`, `Item.Rarity.*`), not `category` enum | User 2026-07-16 |
| D2 | **`maxStack === 1`** = non-stackable; no `stackable` boolean | User |
| D3 | **`sellValue` on ItemDefinition** — all items have sell value; not a fragment | User 2026-07-16 |
| D4 | **`equipment` fragment** merges equip slots + granted cards (not separate `equipable` / `grants_cards`) | User 2026-07-16 |
| D5 | **`durability` fragment** stays separate (other item types may share it later) | User |
| D6 | Inventory **12 slots**; each entry occupies one slot | User |
| D7 | Victory loot: **status hint**; user opens `B` to pickup | User |
| D8 | Discard: **whole slot** only in v1 | User |
| D9 | Drops from **static** `battle-rewards.json` (probe/testing, not final gameplay) | User |
| D10 | Package home: **`packages/items/`**; combat stays unaware of inventory | Plan |

---

## ItemDefinition wire

```json
{
  "id": "iron_sword",
  "name": "Iron Sword",
  "tags": ["Item.Category.Equipment", "Item.Slot.Hand", "Item.Rarity.Common"],
  "maxStack": 1,
  "sellValue": 25,
  "fragments": [
    {
      "kind": "equipment",
      "slots": ["Hand.Main", "Hand.Off"],
      "twoHandMode": "optional",
      "cards": [{ "cardId": "strike", "count": 2 }]
    },
    { "kind": "durability", "max": 20 }
  ]
}
```

### Base fields

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | Unique |
| `name` | string | Display |
| `tags` | string[] | Registered with tag manager at load |
| `maxStack` | number | `1` = non-stackable |
| `sellValue` | number | ≥ 0; every item |
| `fragments` | array | Optional capability blocks |

### Fragment kinds (v1)

| kind | Role | ITEM-F01 runtime |
|------|------|------------------|
| `equipment` | Slots, two-hand mode, granted cards | Parse + query only |
| `durability` | Max durability | Parse + instance state on pickup |
| `consumable_use` | Future use effect ref | Parse only |
| `passive_effects` | Future passive GE refs | Parse only |

**Not fragments:** sell value, id, name, tags, maxStack.

---

## Runtime model

### Inventory entry

- **Stack:** `{ kind: 'stack', itemId, quantity }` when fungible, no per-instance state.
- **Instance:** `{ kind: 'instance', itemId, instanceId, state? }` when `maxStack === 1` or stateful fragments.

`durability` instance state: `{ durability: { current: number } }` initialized from fragment `max` on pickup.

### Operations

| API | Behavior |
|-----|----------|
| `canAdd(itemId, qty)` | Merge into existing stack or free slots |
| `add(itemId, qty)` | Returns added count / reason if partial |
| `discardSlot(index)` | Remove entire slot |
| `listSlots()` | For CLI render |

### Loot flow

```text
Combat victory → load battle-rewards.json → PendingLoot entries
Status: "Victory! Press B for loot."
B overlay → Loot panel + Inventory panel
P / Enter → pickup selected loot entry
D → discard selected inventory slot
```

---

## Data layout

```text
data/items/
  gold_coin.json
  healing_herb.json
  iron_sword.json
  scrap_metal.json
data/combat/
  battle-rewards.json   # static probe table
```

---

## Code layout

```text
packages/items/
  item-definition.ts
  fragments.ts
  inventory.ts
  loot.ts
  data/parse-item.ts
  data/item-bootstrap.ts
packages/cli/          # overlay, input, run state
packages/combat/       # unchanged (victory only via snapshot.result)
```

---

## Exit criteria

- [x] Item JSON loads with fragment validation
- [x] 12-slot inventory add/discard/stack merge
- [x] Victory grants static loot; hint in status line
- [x] `B` overlay shows loot + inventory; pickup + whole-slot discard
- [x] Tests + `npm run verify` green
