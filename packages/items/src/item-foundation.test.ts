import { describe, expect, it } from 'vitest';

import { GameplayTagManager } from '@cardgame/core';

import { buildItemCatalog, parseItemDefinition } from './data/parse-item.js';
import {
  addToInventory,
  canAddToInventory,
  createInventory,
  discardInventorySlot,
  listInventorySlots,
  resetItemInstanceCounter,
} from './inventory.js';
import {
  createPendingLootFromTable,
  pickupLootEntry,
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
      ],
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

  it('requires sellValue on every item', () => {
    expect(() =>
      parseItemDefinition(
        {
          id: 'bad',
          name: 'Bad',
          tags: ['Item.Category.Material'],
          maxStack: 1,
          sellValue: -1,
        },
        manager,
      ),
    ).toThrow(/sellValue/);
  });

  it('parses merged equipment fragment with cards', () => {
    const def = catalog.iron_sword;
    expect(def).toBeDefined();
    const equipment = def?.fragments.find((fragment) => fragment.kind === 'equipment');
    expect(equipment?.kind).toBe('equipment');
    if (equipment?.kind === 'equipment') {
      expect(equipment.cards).toEqual([{ cardId: 'strike', count: 2 }]);
    }
  });
});

describe('inventory', () => {
  it('merges stackable items and respects maxStack', () => {
    const inventory = createInventory(4);
    expect(addToInventory(inventory, catalog, 'gold_coin', 50).ok).toBe(true);
    expect(addToInventory(inventory, catalog, 'gold_coin', 50).ok).toBe(true);
    expect(inventory.entries).toHaveLength(2);
    expect(inventory.entries[0]).toEqual({ kind: 'stack', itemId: 'gold_coin', quantity: 99 });
    expect(inventory.entries[1]).toEqual({ kind: 'stack', itemId: 'gold_coin', quantity: 1 });
  });

  it('stores non-stackable items as instances with durability state', () => {
    resetItemInstanceCounter(1);
    const inventory = createInventory(4);
    const result = addToInventory(inventory, catalog, 'iron_sword', 1);
    expect(result.ok).toBe(true);
    expect(inventory.entries[0]?.kind).toBe('instance');
    if (inventory.entries[0]?.kind === 'instance') {
      expect(inventory.entries[0].state).toEqual({ durability: { current: 20 } });
    }
  });

  it('fails pickup when inventory is full', () => {
    const inventory = createInventory(1);
    resetItemInstanceCounter(10);
    addToInventory(inventory, catalog, 'iron_sword', 1);
    expect(canAddToInventory(inventory, catalog, 'iron_sword', 1)).toBe(false);
  });

  it('discards entire slot', () => {
    const inventory = createInventory(4);
    addToInventory(inventory, catalog, 'gold_coin', 3);
    expect(discardInventorySlot(inventory, 0)).toBe(true);
    expect(inventory.entries).toHaveLength(0);
    expect(listInventorySlots(inventory, catalog)).toEqual([]);
  });
});

describe('loot', () => {
  it('pickups loot into inventory and removes entry when fully collected', () => {
    const inventory = createInventory(12);
    const loot = createPendingLootFromTable({
      id: 'test',
      entries: [{ itemId: 'gold_coin', quantity: 5 }],
    });
    const result = pickupLootEntry(loot, inventory, catalog, 0);
    expect(result.ok).toBe(true);
    expect(loot.entries).toHaveLength(0);
    expect(inventory.entries[0]).toEqual({ kind: 'stack', itemId: 'gold_coin', quantity: 5 });
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
