import { describe, expect, it } from 'vitest';

import { GameplayTagManager } from '@cardgame/core';

import { buildItemCatalog } from './data/parse-item.js';
import { buildDeckIdsFromLoadout } from './deck-from-equipment.js';
import {
  createEquipmentLoadout,
  equipFromInventory,
  unequipToInventory,
} from './equipment-loadout.js';
import { addToInventory, createInventory, resetItemInstanceCounter } from './inventory.js';

const manager = GameplayTagManager.fromDefinitions({
  json: [
    'Item.Category.Equipment',
    'Item.Rarity.Common',
    'Item.Slot.Hand',
    'Item.Drop.BattleReward',
  ],
});

const catalog = buildItemCatalog(
  [
    {
      id: 'iron_sword',
      name: 'Iron Sword',
      tags: ['Item.Category.Equipment', 'Item.Slot.Hand', 'Item.Rarity.Common'],
      maxStack: 1,
      sellValue: 25,
      fragments: [
        {
          kind: 'equipment',
          slots: ['Hand.Main', 'Hand.Off'],
          twoHandMode: 'optional',
          cards: [{ cardId: 'heavy_blow', count: 2 }],
        },
        { kind: 'durability', max: 20 },
        { kind: 'inventory_shape', width: 1, height: 3 },
      ],
    },
    {
      id: 'great_axe',
      name: 'Great Axe',
      tags: ['Item.Category.Equipment', 'Item.Slot.Hand', 'Item.Rarity.Common'],
      maxStack: 1,
      sellValue: 40,
      fragments: [
        {
          kind: 'equipment',
          slots: ['Hand.Main', 'Hand.Off'],
          twoHandMode: 'required',
          cards: [{ cardId: 'bash', count: 1 }],
        },
        { kind: 'inventory_shape', width: 2, height: 2 },
      ],
    },
    {
      id: 'wooden_shield',
      name: 'Wooden Shield',
      tags: ['Item.Category.Equipment', 'Item.Slot.Hand', 'Item.Rarity.Common'],
      maxStack: 1,
      sellValue: 12,
      fragments: [
        {
          kind: 'equipment',
          slots: ['Hand.Off'],
          twoHandMode: 'forbidden',
          cards: [{ cardId: 'mend', count: 2 }],
        },
        { kind: 'inventory_shape', width: 2, height: 2 },
      ],
    },
  ],
  manager,
);

describe('equipment loadout', () => {
  it('equips optional hand gear into first free compatible slot and leaves backpack', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    const loadout = createEquipmentLoadout();
    addToInventory(inventory, catalog, 'iron_sword', 1);
    const entryId = inventory.entries[0]?.entryId;
    expect(entryId).toBeDefined();
    if (!entryId) {
      return;
    }

    const result = equipFromInventory(loadout, inventory, catalog, entryId);
    expect(result.ok).toBe(true);
    expect(inventory.entries).toHaveLength(0);
    expect(loadout.slotOf['Hand.Main']).toBe(entryId);
    expect(loadout.slotOf['Hand.Off']).toBeUndefined();
  });

  it('required two-hand gear occupies both hand slots', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    const loadout = createEquipmentLoadout();
    addToInventory(inventory, catalog, 'great_axe', 1);
    const entryId = inventory.entries[0]?.entryId;
    expect(entryId).toBeDefined();
    if (!entryId) {
      return;
    }

    expect(equipFromInventory(loadout, inventory, catalog, entryId).ok).toBe(true);
    expect(loadout.slotOf['Hand.Main']).toBe(entryId);
    expect(loadout.slotOf['Hand.Off']).toBe(entryId);
  });

  it('unequips back into backpack and injects cards into deck build', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    const loadout = createEquipmentLoadout();
    addToInventory(inventory, catalog, 'iron_sword', 1);
    addToInventory(inventory, catalog, 'wooden_shield', 1);
    const swordId = inventory.entries.find((entry) => entry.payload.itemId === 'iron_sword')?.entryId;
    const shieldId = inventory.entries.find((entry) => entry.payload.itemId === 'wooden_shield')?.entryId;
    expect(swordId && shieldId).toBeTruthy();
    if (!swordId || !shieldId) {
      return;
    }

    expect(equipFromInventory(loadout, inventory, catalog, swordId).ok).toBe(true);
    expect(equipFromInventory(loadout, inventory, catalog, shieldId).ok).toBe(true);

    const deck = buildDeckIdsFromLoadout(['wait'], loadout, catalog);
    expect(deck).toEqual(['wait', 'heavy_blow', 'heavy_blow', 'mend', 'mend']);

    expect(unequipToInventory(loadout, inventory, catalog, swordId).ok).toBe(true);
    expect(loadout.slotOf['Hand.Main']).toBeUndefined();
    expect(inventory.entries.some((entry) => entry.payload.itemId === 'iron_sword')).toBe(true);
  });

  it('rejects required two-hand when a hand is occupied', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    const loadout = createEquipmentLoadout();
    addToInventory(inventory, catalog, 'iron_sword', 1);
    addToInventory(inventory, catalog, 'great_axe', 1);
    const swordId = inventory.entries.find((entry) => entry.payload.itemId === 'iron_sword')?.entryId;
    const axeId = inventory.entries.find((entry) => entry.payload.itemId === 'great_axe')?.entryId;
    expect(swordId && axeId).toBeTruthy();
    if (!swordId || !axeId) {
      return;
    }
    expect(equipFromInventory(loadout, inventory, catalog, swordId).ok).toBe(true);
    expect(equipFromInventory(loadout, inventory, catalog, axeId)).toEqual({
      ok: false,
      reason: 'hands_busy',
    });
  });
});
