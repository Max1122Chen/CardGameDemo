import { describe, expect, it, beforeEach } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import {
  collectItemTagsFromRepo,
  listEquippedPieces,
  listInventorySlots,
  loadItemCatalogFromRepo,
  resetItemInstanceCounter,
} from '@cardgame/items';

import {
  buildCharacterCatalog,
  loadBehaviorTreeIds,
  loadCharacterCatalogFromRepo,
  resolveRepoDataRoot,
  spawnCharacterById,
} from './index.js';

describe('CHAR-F01 character package', () => {
  const dataRoot = resolveRepoDataRoot();
  let itemCatalog: ReturnType<typeof loadItemCatalogFromRepo>;

  beforeEach(() => {
    resetItemInstanceCounter(1);
    const engine = RuleEngine.create({
      tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
    });
    itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
  });

  it('loads character catalog from repo data', () => {
    const catalog = loadCharacterCatalogFromRepo({ dataRoot });
    expect(catalog.slime?.name).toBe('Slime');
    expect(catalog.orc_brute?.behaviorTreeId).toBe('bt.orc_stub');
  });

  it('spawns slime with innate equipment deck and empty grid', () => {
    const catalog = loadCharacterCatalogFromRepo({ dataRoot });
    const btIds = loadBehaviorTreeIds(dataRoot);
    const instance = spawnCharacterById(catalog, 'slime', { itemCatalog, behaviorTreeIds: btIds });

    expect(instance.displayName).toBe('Slime');
    expect(instance.maxHealth).toBe(24);
    expect(instance.deckIds).toContain('strike');
    expect(instance.deckIds).toContain('weaken');
    expect(listEquippedPieces(instance.loadout).length).toBe(1);
    expect(listInventorySlots(instance.inventory, itemCatalog).length).toBe(0);
  });

  it('spawns orc with equipment, backpack items, and richer deck', () => {
    const catalog = loadCharacterCatalogFromRepo({ dataRoot });
    const btIds = loadBehaviorTreeIds(dataRoot);
    const instance = spawnCharacterById(catalog, 'orc_brute', { itemCatalog, behaviorTreeIds: btIds });

    expect(instance.deckIds.length).toBeGreaterThan(2);
    expect(listEquippedPieces(instance.loadout).length).toBe(2);
    const bag = listInventorySlots(instance.inventory, itemCatalog);
    expect(bag.some((slot) => slot.itemId === 'healing_herb')).toBe(true);
    expect(bag.some((slot) => slot.itemId === 'gold_coin')).toBe(true);
  });

  it('rejects unknown behavior tree id', () => {
    const catalog = buildCharacterCatalog([
      {
        id: 'bad',
        name: 'Bad',
        maxHealth: 1,
        primaries: {
          strength: 10,
          constitution: 10,
          dexterity: 10,
          intelligence: 10,
          wisdom: 10,
          charisma: 10,
        },
        behaviorTreeId: 'bt.missing',
        equipment: [],
        inventory: [],
        loot: { entries: [] },
      },
    ]);
    expect(() =>
      spawnCharacterById(catalog, 'bad', { itemCatalog, behaviorTreeIds: new Set(['bt.slime_cycle']) }),
    ).toThrow(/behaviorTreeId/);
  });
});
