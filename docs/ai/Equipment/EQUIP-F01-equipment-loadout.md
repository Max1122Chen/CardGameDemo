# EQUIP-F01 — Equipment loadout and deck injection

## Meta
- **ID:** EQUIP-F01
- **Status:** Done
- **Owner:** —
- **Last updated:** 2026-07-16
- **Related:** [ITEM-F01](../Items/ITEM-F01-item-foundation.md), [ITEM-F02](../Items/ITEM-F02-grid-backpack.md), [DATA-F01](../Data/DATA-F01-card-asset-pipeline.md)
- **Gameplay (read-only):** [equipment-and-cards.md](../../design/systems/equipment-and-cards.md)

Depends on: ITEM-F01 Done, ITEM-F02 Done  
Blocks: EQUIP-F02 (durability wear, dual-wield variants, passives)

---

## TL;DR

1. **EquipmentLoadout** — slot board separate from backpack grid.
2. **Equip / unequip** — item leaves backpack when worn; returns on unequip (needs free cells).
3. **Deck = base starter + granted cards** from equipped `equipment` fragments.
4. **Modify loadout only after combat ends** (victory/defeat); next battle rebuild uses loadout.
5. **Two-hand v1:** `required` occupies both hand slots; `optional`/`forbidden` equip one compatible free slot.

**Non-goals:** AP equip window, rest free-swap, durability loss, dual-wield card tables, dungeon-bound gear, accessory passives, primary stat bonuses from gear.

---

## Locked decisions

| ID | Decision | Source |
|----|----------|--------|
| D1 | Deck model = **base deck + equipment injection** | User 2026-07-16 (default B) |
| D2 | Two-hand v1 = **`required` dual-occupy**; no optional dual-wield card variants | User (default A) |
| D3 | Loadout edits only when **`combatResult` set**; deck applies on next battle bootstrap | User (default A) |
| D4 | Equipped items **leave backpack** | User (default A) |
| D5 | Reuse existing `equipment` + `durability` fragments; no parallel EquipmentDefinition | ITEM-F01 |
| D6 | Slots: `Hand.Main`, `Hand.Off`, `Head`, `Chest`, `Legs`, `Feet` | design doc |

---

## Runtime model

```text
EquipmentLoadout {
  pieces: Map<entryId, EquippedPiece>
  slotOf: Map<slotId, entryId>   // two-hand: two slots -> same entryId
}

EquippedPiece {
  entryId
  payload   // InventoryPayload (instance)
  itemId
  occupiedSlots: EquipmentSlotId[]
}
```

### Equip rules

1. Bag entry must have `equipment` fragment.
2. Prefer first free slot listed in `fragment.slots`.
3. If `twoHandMode === 'required'`: both `Hand.Main` and `Hand.Off` must be empty; occupy both.
4. Else: occupy one free compatible slot.
5. On success: remove entry from grid inventory.

### Unequip rules

1. `findFirstFit` for payload's itemId; fail if inventory full.
2. Clear all `occupiedSlots`; place payload back via auto-fit.

### Deck build

```text
deckIds = [...baseStarterDeckIds, ...expand(loadout.equipment.cards)]
```

Order: base first, then pieces in stable slot order (Main, Off, Head, …).

---

## CLI

- Inventory overlay gains **Equipment** panel (Tab: loot → backpack → equipment).
- `E` equip selected backpack item (only after combat end).
- `U` unequip selected equipment piece.
- Console `battle` restarts combat with rebuilt deck (loadout + inventory persist).

---

## Exit criteria

- [x] Loadout equip/unequip with hand two-hand required
- [x] Deck rebuild from base + grants
- [x] CLI panel + post-combat gate + `battle` restart
- [x] Probe: iron_sword + wooden_shield
- [x] Tests + `npm run verify` green
