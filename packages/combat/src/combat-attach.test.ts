import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { collectItemTagsFromRepo, loadItemCatalogFromRepo } from '@cardgame/items';

import { CombatSession } from './combat-session.js';
import { combatBootstrapConfig, resolveRepoDataRoot } from './data/combat-bootstrap.js';
import { COMBAT_ENEMY_ID, COMBAT_PLAYER_ID } from './types.js';

function createEngine() {
  const dataRoot = resolveRepoDataRoot();
  const engine = RuleEngine.create({
    tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
  });
  const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
  return { engine, itemCatalog };
}

describe('DUNGEON-F01 S04 CombatSession.attach / detach', () => {
  it('reuses player Health across attach → detach → attach', () => {
    const { engine, itemCatalog } = createEngine();

    const first = CombatSession.attach(
      engine,
      combatBootstrapConfig(engine, {
        itemCatalog,
        enemyStartHealth: 8,
        openingHand: ['strike', 'strike', 'defend', 'defend', 'bash'],
      }),
      { reusePlayer: false },
    );

    first.applyAction({ type: 'PlayCard', handIndex: 0 });
    expect(first.getSnapshot().result).toBe('victory');

    const damagedHp = first.getSnapshot().player.health;
    expect(damagedHp).toBeLessThanOrEqual(30);

    // Simulate damage taken before next fight by lowering HP after detach.
    const end = first.detach();
    expect(end.result).toBe('victory');
    expect(engine.getGfc(COMBAT_PLAYER_ID)).toBeDefined();
    expect(engine.getGfc(COMBAT_ENEMY_ID)).toBeUndefined();

    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('Health', 22);

    const second = CombatSession.attach(
      engine,
      combatBootstrapConfig(engine, {
        itemCatalog,
        enemyCharacterId: 'slime',
        enemyStartHealth: 8,
        openingHand: ['strike', 'strike', 'defend', 'defend', 'bash'],
      }),
      { reusePlayer: true },
    );

    expect(second.getSnapshot().player.health).toBe(22);
    expect(second.getSnapshot().enemies[0]?.health).toBe(8);

    second.applyAction({ type: 'PlayCard', handIndex: 0 });
    expect(second.getSnapshot().result).toBe('victory');

    const end2 = second.detach();
    expect(end2.playerHealth).toBe(22);
    expect(engine.requireGfc(COMBAT_PLAYER_ID).getAttribute('Health')?.currentValue).toBe(22);
  });

  it('rejects reusePlayer when no player GFC exists', () => {
    const { engine, itemCatalog } = createEngine();
    expect(() =>
      CombatSession.attach(
        engine,
        combatBootstrapConfig(engine, { itemCatalog }),
        { reusePlayer: true },
      ),
    ).toThrow(/combat-ready player/);
  });

  it('clears Block on detach', () => {
    const { engine, itemCatalog } = createEngine();
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, {
        itemCatalog,
        openingHand: ['defend', 'defend', 'strike', 'strike', 'bash'],
      }),
    );
    session.applyAction({ type: 'PlayCard', handIndex: 0 });
    expect(session.getSnapshot().player.block).toBeGreaterThan(0);

    session.detach();
    expect(engine.requireGfc(COMBAT_PLAYER_ID).getAttribute('Block')?.currentValue).toBe(0);
  });
});
