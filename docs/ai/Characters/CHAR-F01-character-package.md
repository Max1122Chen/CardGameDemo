# CHAR-F01 — `@cardgame/characters` package (definitions, spawn, instances)

## Meta
- **ID:** CHAR-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-17
- **Related:** [COMBAT-F05](../Combat/COMBAT-F05-enemy-data-driven.md), [EQUIP-F01](../Equipment/EQUIP-F01-equipment-loadout.md), [ITEM-F02](../Items/ITEM-F02-grid-backpack.md)

Depends on: ITEM-F01, ITEM-F02, EQUIP-F01  
Blocks: COMBAT-F05 spawn path, DUNGEON-F01 (room entities)

---

## TL;DR

New package **`@cardgame/characters`**:

1. **`CharacterDefinition`** wire + loader (`data/characters/` or `data/enemies/` — see COMBAT-F05).
2. **`spawnCharacterInstance`** — builds runtime instance: loadout, grid inventory, deck ids, `behaviorTreeId`, loot profile.
3. **Shared model** for player template (later) and enemies/NPCs today.
4. **No combat rules** — combat/combat-session consumes `CharacterInstance` + registers BT tasks.

---

## Instance model

```typescript
type CharacterInstance = {
  definitionId: string;
  displayName: string;
  primaries: PrimaryAttributeBlock;
  maxHealth: number;
  maxActionPoints?: number;
  loadout: EquipmentLoadout;
  inventory: InventoryState;
  deckIds: readonly string[];
  behaviorTreeId: string;
  loot: CharacterLootProfile;
};
```

Spawn steps:

1. Load definition + validate item/card/BT refs.
2. Create empty loadout + inventory grid (default 4×6 or def override).
3. Equip listed `equipment[]` (including innate).
4. Place `inventory[]` items on grid.
5. `deckIds = buildDeckIdsFromLoadout([], loadout, itemCatalog)`.
6. Attach `behaviorTreeId` (no tick here).

---

## Acceptance

- [x] Package builds; depends on `items`, not `combat`/`cli`
- [x] `spawnCharacterInstance('slime')` returns loadout + grid + deck
- [x] Tests with fixture JSON

---

## Changelog

| Date | Note |
|------|------|
| 2026-07-17 | Implemented: `@cardgame/characters`, slime/orc JSON, innate equipment, 4 tests |
| 2026-07-17 | Initial spec (Review); user: create characters package now |
