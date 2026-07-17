import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { collectItemTagsFromRepo, loadItemCatalogFromRepo } from '@cardgame/items';
import { COMBAT_PLAYER_ID, resolveRepoDataRoot } from '@cardgame/combat';

import { AdventureSession } from './adventure-session.js';
import { beginAdventureCombat, finishAdventureCombat } from './combat-bridge.js';
import { loadLevelFromRepo } from './load-level.js';

describe('DUNGEON-F01 AdventureSession + combat handoff', () => {
  it('confirm → combat → victory loot on room; HP persists to next fight', () => {
    const dataRoot = resolveRepoDataRoot();
    const engine = RuleEngine.create({
      tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
    });
    const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });

    const adventure = AdventureSession.start(loadLevelFromRepo('level.probe'));
    adventure.applyAction({ type: 'Move', direction: 'east' });
    adventure.applyAction({ type: 'ConfirmCombat' });

    const combat = beginAdventureCombat(adventure, engine, {
      itemCatalog,
      enemyStartHealth: 8,
      openingHand: ['strike', 'strike', 'defend', 'defend', 'bash'],
    });
    combat.applyAction({ type: 'PlayCard', handIndex: 0 });
    expect(combat.getSnapshot().result).toBe('victory');

    finishAdventureCombat(adventure, combat, { itemCatalog, lootRng: () => 0 });
    expect(adventure.getPhase()).toBe('explore');
    expect(adventure.getRoomState('hall_a').cleared).toBe(true);
    expect(adventure.getRoomState('hall_a').loot.length).toBeGreaterThan(0);

    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('Health', 19);

    adventure.applyAction({ type: 'Move', direction: 'east' });
    adventure.applyAction({ type: 'ConfirmCombat' });

    const combat2 = beginAdventureCombat(adventure, engine, {
      itemCatalog,
      enemyStartHealth: 8,
      openingHand: ['strike', 'strike', 'defend', 'defend', 'bash'],
    });
    expect(combat2.getSnapshot().player.health).toBe(19);
    combat2.applyAction({ type: 'PlayCard', handIndex: 0 });
    const end = finishAdventureCombat(adventure, combat2, { itemCatalog, lootRng: () => 0 });
    expect(end.playerHealth).toBe(19);
    expect(adventure.getPhase()).toBe('explore');
    expect(adventure.getCurrentRoomId()).toBe('hall_b');
  });
});
