import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { createPendingLootFromCharacter } from '@cardgame/items';
import { collectItemTagsFromRepo, loadItemCatalogFromRepo } from '@cardgame/items';
import {
  loadBehaviorTreeIds,
  loadCharacterCatalogFromRepo,
  spawnCharacterById,
} from '@cardgame/characters';

import { CombatSession } from './combat-session.js';
import { combatBootstrapConfig, resolveRepoDataRoot } from './data/combat-bootstrap.js';

describe('COMBAT-F05 data-driven enemies', () => {
  const dataRoot = resolveRepoDataRoot();

  function createEngineWithCatalog() {
    const engine = RuleEngine.create({
      tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
    });
    const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
    return { engine, itemCatalog };
  }

  it('slime cycles defend / weaken / strike with preview-style intent labels', () => {
    const { engine, itemCatalog } = createEngineWithCatalog();
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, { itemCatalog, enemyCharacterId: 'slime' }),
    );

    expect(session.getSnapshot().enemyIntent?.label).toBe('Gain block 5');

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().combatLog.some((line) => line.includes('Defend played'))).toBe(
      true,
    );
    expect(session.getSnapshot().enemies[0]?.block).toBe(5);
    expect(session.getSnapshot().enemyIntent?.label).toBe('Weaken');

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().combatLog.some((line) => line.includes('Weaken played'))).toBe(
      true,
    );
    expect(session.getSnapshot().enemyIntent?.label).toMatch(/^Attack \d+$/);

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().combatLog.some((line) => line.includes('Strike played'))).toBe(
      true,
    );
    expect(session.getSnapshot().enemyIntent?.label).toBe('Gain block 5');
  });

  it('slime defend block absorbs player strike damage', () => {
    const { engine, itemCatalog } = createEngineWithCatalog();
    const probeDeck = [
      'defend',
      'defend',
      'defend',
      'defend',
      'defend',
      'strike',
      'bash',
      'jab',
      'surge',
      'precise_cut',
    ];
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, {
        itemCatalog,
        enemyCharacterId: 'slime',
        deckIds: probeDeck,
        turnDraw: 1,
      }),
    );

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().enemies[0]?.block).toBe(5);

    const beforeHp = session.getSnapshot().enemies[0]!.health;
    expect(session.getSnapshot().hand[0]?.actionId).toBe('strike');
    session.applyAction({ type: 'PlayCard', handIndex: 0 });

    const after = session.getSnapshot();
    expect(after.enemies[0]?.block).toBe(0);
    expect(after.enemies[0]!.health).toBeLessThan(beforeHp);
  });

  it('spawns orc brute with richer deck from equipment data', () => {
    const { engine, itemCatalog } = createEngineWithCatalog();
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, { itemCatalog, enemyCharacterId: 'orc_brute' }),
    );

    const enemy = session.getEnemyCharacterInstance();
    expect(enemy.displayName).toBe('Orc Brute');
    expect(enemy.deckIds.length).toBeGreaterThan(3);
    expect(session.getSnapshot().enemies[0]?.name).toBe('Orc Brute');
    expect(session.getSnapshot().enemies[0]?.health).toBe(40);
  });

  it('victory loot skips innate slime body but includes rolled gold', () => {
    const catalog = loadCharacterCatalogFromRepo({ dataRoot });
    const itemCatalog = createEngineWithCatalog().itemCatalog;
    const btIds = loadBehaviorTreeIds(dataRoot);
    const slime = spawnCharacterById(catalog, 'slime', { itemCatalog, behaviorTreeIds: btIds });

    const loot = createPendingLootFromCharacter(
      {
        loadout: slime.loadout,
        inventory: slime.inventory,
        lootEntries: slime.loot.entries,
      },
      itemCatalog,
      () => 0,
    );

    expect(loot.entries.some((entry) => entry.itemId === 'slime_body')).toBe(false);
    expect(loot.entries.some((entry) => entry.itemId === 'gold_coin')).toBe(true);
  });

  it('orc defeat loot includes backpack items and droppable gear', () => {
    const catalog = loadCharacterCatalogFromRepo({ dataRoot });
    const { itemCatalog } = createEngineWithCatalog();
    const btIds = loadBehaviorTreeIds(dataRoot);
    const orc = spawnCharacterById(catalog, 'orc_brute', { itemCatalog, behaviorTreeIds: btIds });

    const loot = createPendingLootFromCharacter(
      {
        loadout: orc.loadout,
        inventory: orc.inventory,
        lootEntries: orc.loot.entries,
      },
      itemCatalog,
      () => 0,
    );

    const ids = loot.entries.map((entry) => entry.itemId);
    expect(ids).toContain('healing_herb');
    expect(ids).toContain('gold_coin');
    expect(ids).toContain('orc_axe');
    expect(ids).toContain('orc_armor');
  });
});
