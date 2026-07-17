import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { collectItemTagsFromRepo, loadItemCatalogFromRepo } from '@cardgame/items';

import { CombatSession } from './combat-session.js';
import { combatBootstrapConfig, resolveRepoDataRoot } from './data/combat-bootstrap.js';

describe('COMBAT-F06 tactical orc AI', () => {
  const dataRoot = resolveRepoDataRoot();

  function createOrcSession(
    overrides: Parameters<typeof combatBootstrapConfig>[1] = {},
  ): CombatSession {
    const engine = RuleEngine.create({
      tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
    });
    const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
    return CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, { itemCatalog, enemyCharacterId: 'orc_brute', ...overrides }),
    );
  }

  it('orc uses tactical behavior tree', () => {
    const session = createOrcSession();
    expect(session.getEnemyCharacterInstance().behaviorTreeId).toBe('bt.orc_tactical');
  });

  it('orc intent reflects playBestCard damage branch when healthy', () => {
    const session = createOrcSession();
    const intent = session.getSnapshot().enemyIntent?.label ?? '';
    expect(intent).toMatch(/^Attack \d+$/);
    expect(intent).not.toBe('Gain block 5');
  });

  it('orc defends when below Intelligence-modulated self HP threshold', () => {
    const session = createOrcSession({ enemyStartHealth: 15, enemyOpeningDraw: 6 });

    const intent = session.getSnapshot().enemyIntent?.label;
    expect(intent).toBe('Gain block 5');

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().combatLog.some((line) => line.includes('Defend played'))).toBe(
      true,
    );
    expect(session.getSnapshot().enemies[0]?.block).toBe(5);
  });

  it('orc intent matches card played on next enemy turn', () => {
    const session = createOrcSession();
    const beforeIntent = session.getSnapshot().enemyIntent?.label ?? '';
    expect(beforeIntent).toMatch(/^Attack \d+$/);

    session.applyAction({ type: 'EndTurn' });
    const log = session.getSnapshot().combatLog.join('\n');
    expect(log).toMatch(new RegExp(`Orc Brute: (Strike|Bash|Heavy Blow) played`));
  });

  it('enemy prep at player turn start keeps intent valid across many rounds', () => {
    const session = createOrcSession({ playerStartHealth: 200 });
    for (let round = 0; round < 6; round += 1) {
      expect(session.getSnapshot().enemyIntent?.label).not.toBe('Unknown');
      session.applyAction({ type: 'EndTurn' });
    }
    expect(session.getSnapshot().enemyIntent?.label).not.toBe('Unknown');
  });

  it('slime fixed cycle unchanged with low Intelligence', () => {
    const engine = RuleEngine.create({
      tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
    });
    const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, { itemCatalog, enemyCharacterId: 'slime' }),
    );

    expect(session.getSnapshot().enemyIntent?.label).toBe('Gain block 5');
    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().enemyIntent?.label).toBe('Weaken');
  });
});
