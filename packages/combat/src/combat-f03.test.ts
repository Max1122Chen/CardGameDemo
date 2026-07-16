import { describe, expect, it } from 'vitest';

import { combatBootstrapConfig } from './data/combat-bootstrap.js';
import { RuleEngine } from '@cardgame/core';
import { CombatSession } from './combat-session.js';
import type { CardActionId } from './types.js';
import { COMBAT_ENEMY_ID } from './types.js';

function createSession(openingHand: readonly CardActionId[]): CombatSession {
  const engine = RuleEngine.create();
  return CombatSession.bootstrap(engine, combatBootstrapConfig(engine, { openingHand }));
}

function handIndex(session: CombatSession, actionId: CardActionId): number {
  const snapshot = session.getSnapshot();
  const index = snapshot.hand.findIndex((card) => card.actionId === actionId);
  if (index < 0) {
    throw new Error(`Card ${actionId} not in hand`);
  }
  return index;
}

function previewAndPlay(session: CombatSession, actionId: CardActionId, target = COMBAT_ENEMY_ID): void {
  const index = handIndex(session, actionId);
  session.beginCardPreview(index, target);
  session.applyAction({ type: 'PlayCard', handIndex: index });
}

describe('COMBAT-F03 probes', () => {
  it('P1 Weaken then Strike deals +25% absorbed damage (floor)', () => {
    const session = createSession(['weaken', 'strike']);
    previewAndPlay(session, 'weaken');
    previewAndPlay(session, 'strike');

    expect(session.getSnapshot().enemies[0]!.health).toBe(2);
  });

  it('P4 two Defends stack block against enemy attack', () => {
    const session = createSession(['defend', 'defend']);
    previewAndPlay(session, 'defend');
    previewAndPlay(session, 'defend');
    session.applyAction({ type: 'EndTurn' });

    expect(session.getSnapshot().player.health).toBe(30);
  });

  it('P5 Wait spends AP without dealing damage', () => {
    const session = createSession(['wait']);
    const beforeHp = session.getSnapshot().enemies[0]!.health;
    previewAndPlay(session, 'wait');

    const snapshot = session.getSnapshot();
    expect(snapshot.player.actionPoints).toBe(2);
    expect(snapshot.enemies[0]!.health).toBe(beforeHp);
  });

  it('Weaken preview shows no damage until Strike follows', () => {
    const session = createSession(['weaken']);
    session.beginCardPreview(handIndex(session, 'weaken'), COMBAT_ENEMY_ID);

    const preview = session.getSnapshot().preview;
    expect(preview?.damage ?? 0).toBe(0);
    expect(preview?.damageToTake ?? 0).toBe(0);
  });

  it('Weaken duration stacks on second apply', () => {
    const engine = RuleEngine.create();
    const session = CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, {
        openingHand: ['weaken', 'weaken'],
        deckIds: ['weaken', 'weaken', 'wait'],
      }),
    );
    const enemy = engine.requireGfc(COMBAT_ENEMY_ID);

    previewAndPlay(session, 'weaken');
    previewAndPlay(session, 'weaken');

    const vulnerable = enemy.listActiveEffects().find((e) => e.definition.id === 'ge.status.vulnerable');
    expect(vulnerable?.stackedDurationMagnitude).toBe(2);
  });
});
