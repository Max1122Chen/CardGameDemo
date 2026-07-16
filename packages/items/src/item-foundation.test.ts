import { describe, expect, it } from 'vitest';

import { GameplayTagManager } from '@cardgame/core';

import { buildItemCatalog, parseItemDefinition } from './data/parse-item.js';
import {
  addToInventory,
  canAddToInventory,
  canPlaceAt,
  createInventory,
  discardInventoryEntry,
  findFirstFit,
  listInventorySlots,
  moveInventoryEntry,
  placeLootAt,
  resetItemInstanceCounter,
  tidyInventory,
} from './inventory.js';
import {
  createPendingLootFromTable,
  pickupLootEntry,
  placePendingLootEntry,
  validateBattleRewards,
} from './loot.js';

const manager = GameplayTagManager.fromDefinitions({
  json: [
    'Item.Category.Currency',
    'Item.Category.Consumable',
    'Item.Category.Equipment',
    'Item.Category.Material',
    'Item.Rarity.Common',
    'Item.Slot.Hand',
    'Item.Drop.BattleReward',
  ],
});

const catalog = buildItemCatalog(
  [
    {
      id: 'gold_coin',
      name: 'Gold Coin',
      tags: ['Item.Category.Currency', 'Item.Rarity.Common'],
      maxStack: 99,
      sellValue: 1,
      fragments: [{ kind: 'inventory_shape', width: 1, height: 1 }],
    },
    {
      id: 'iron_sword',
      name: 'Iron Sword',
      tags: ['Item.Category.Equipment', 'Item.Slot.Hand', 'Item.Rarity.Common'],
      maxStack: 1,
      sellValue: 25,
      fragments: [
        {
          kind: 'equipment',
          slots: ['Hand.Main'],
          cards: [{ cardId: 'strike', count: 2 }],
        },
        { kind: 'durability', max: 20 },
        { kind: 'inventory_shape', width: 1, height: 3 },
      ],
    },
    {
      id: 'scrap_metal',
      name: 'Scrap Metal',
      tags: ['Item.Category.Material', 'Item.Rarity.Common'],
      maxStack: 20,
      sellValue: 2,
      fragments: [{ kind: 'inventory_shape', width: 2, height: 1 }],
    },
  ],
  manager,
);

describe('parseItemDefinition', () => {
  it('rejects unknown fragment kinds', () => {
    expect(() =>
      parseItemDefinition(
        {
          id: 'bad',
          name: 'Bad',
          tags: ['Item.Category.Material'],
          maxStack: 1,
          sellValue: 0,
          fragments: [{ kind: 'unknown' } as never],
        },
        manager,
      ),
    ).toThrow(/unknown fragment kind/);
  });

  it('parses inventory_shape fragment', () => {
    const def = catalog.iron_sword;
    const shape = def?.fragments.find((fragment) => fragment.kind === 'inventory_shape');
    expect(shape).toEqual({ kind: 'inventory_shape', width: 1, height: 3 });
  });
});

describe('grid inventory', () => {
  it('auto-places and merges stackable items', () => {
    const inventory = createInventory(4, 6);
    expect(addToInventory(inventory, catalog, 'gold_coin', 50).ok).toBe(true);
    expect(addToInventory(inventory, catalog, 'gold_coin', 50).ok).toBe(true);
    // maxStack 99 => first stack fills to 99, remainder opens a second stack
    expect(inventory.entries).toHaveLength(2);
    expect(inventory.entries[0]?.payload).toEqual({
      kind: 'stack',
      itemId: 'gold_coin',
      quantity: 99,
    });
    expect(inventory.entries[1]?.payload).toEqual({
      kind: 'stack',
      itemId: 'gold_coin',
      quantity: 1,
    });
  });

  it('places tall items with first-fit and supports rotation', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    expect(addToInventory(inventory, catalog, 'iron_sword', 1).ok).toBe(true);
    expect(inventory.entries[0]?.rotation).toBe(0);
    expect(inventory.entries[0]?.y).toBe(0);

    // Fill first column partially by placing another sword below — height 3, so y=3 works.
    expect(addToInventory(inventory, catalog, 'iron_sword', 1).ok).toBe(true);
    expect(inventory.entries).toHaveLength(2);
  });

  it('rejects illegal manual placement', () => {
    const inventory = createInventory(4, 6);
    addToInventory(inventory, catalog, 'iron_sword', 1);
    expect(canPlaceAt(inventory, catalog, 'iron_sword', 0, 0, 0).ok).toBe(false);
    expect(canPlaceAt(inventory, catalog, 'iron_sword', 0, 4, 0).reason).toBe('out_of_bounds');
    expect(placeLootAt(inventory, catalog, 'scrap_metal', 1, 3, 0, 0).ok).toBe(false);
  });

  it('moves selected entry to a new anchor', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    addToInventory(inventory, catalog, 'iron_sword', 1);
    const entryId = inventory.entries[0]?.entryId;
    expect(entryId).toBeDefined();
    if (!entryId) {
      return;
    }
    // 1x3 rotated 90 => 3x1; (0,2) fits on a 4-wide grid
    expect(moveInventoryEntry(inventory, catalog, entryId, 0, 2, 90).ok).toBe(true);
    expect(inventory.entries[0]).toMatchObject({ x: 0, y: 2, rotation: 90 });
  });

  it('tidies with FFD and keeps all entries', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4, 6);
    placeLootAt(inventory, catalog, 'scrap_metal', 1, 2, 4, 0);
    placeLootAt(inventory, catalog, 'gold_coin', 3, 0, 5, 0);
    addToInventory(inventory, catalog, 'iron_sword', 1);
    expect(inventory.entries).toHaveLength(3);
    expect(tidyInventory(inventory, catalog).ok).toBe(true);
    expect(inventory.entries).toHaveLength(3);
    // Largest first: sword area 3, scrap 2, coin 1
    expect(inventory.entries[0]?.payload.itemId).toBe('iron_sword');
    expect(inventory.entries[0]?.x).toBe(0);
    expect(inventory.entries[0]?.y).toBe(0);
  });

  it('discards whole footprint entry', () => {
    const inventory = createInventory(4, 6);
    addToInventory(inventory, catalog, 'gold_coin', 3);
    const entryId = inventory.entries[0]?.entryId;
    expect(entryId).toBeDefined();
    if (!entryId) {
      return;
    }
    expect(discardInventoryEntry(inventory, entryId)).toBe(true);
    expect(inventory.entries).toHaveLength(0);
    expect(listInventorySlots(inventory, catalog)).toEqual([]);
  });

  it('fails when grid cannot fit more tall items', () => {
    resetItemInstanceCounter(10);
    const inventory = createInventory(2, 3);
    expect(addToInventory(inventory, catalog, 'iron_sword', 1).ok).toBe(true);
    // 2x3 can fit two 1x3 swords side by side; third fails
    expect(addToInventory(inventory, catalog, 'iron_sword', 1).ok).toBe(true);
    expect(canAddToInventory(inventory, catalog, 'iron_sword', 1)).toBe(false);
    expect(findFirstFit(inventory, catalog, 'iron_sword')).toBeUndefined();
  });
});

describe('loot', () => {
  it('auto-pickups loot into grid inventory', () => {
    const inventory = createInventory(4, 6);
    const loot = createPendingLootFromTable({
      id: 'test',
      entries: [{ itemId: 'gold_coin', quantity: 5 }],
    });
    const result = pickupLootEntry(loot, inventory, catalog, 0);
    expect(result.ok).toBe(true);
    expect(loot.entries).toHaveLength(0);
  });

  it('manually places loot at coordinates', () => {
    const inventory = createInventory(4, 6);
    const loot = createPendingLootFromTable({
      id: 'test',
      entries: [{ itemId: 'scrap_metal', quantity: 1 }],
    });
    const result = placePendingLootEntry(loot, inventory, catalog, 0, 1, 2, 0);
    expect(result.ok).toBe(true);
    expect(inventory.entries[0]).toMatchObject({ x: 1, y: 2, rotation: 0 });
  });

  it('validates battle rewards against catalog', () => {
    expect(() =>
      validateBattleRewards(
        { id: 'bad', entries: [{ itemId: 'missing', quantity: 1 }] },
        catalog,
      ),
    ).toThrow(/unknown item/);
  });
});
