import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { combatBootstrapConfig } from './data/combat-bootstrap.js';
import { CombatSession } from './combat-session.js';
import { COMBAT_ENEMY_ID, COMBAT_PLAYER_ID, type CardActionId } from './types.js';

function createSession(
  openingHand: readonly CardActionId[],
  tuneables: { playerStartHealth?: number } = {},
): { engine: RuleEngine; session: CombatSession } {
  const engine = RuleEngine.create();
  const base = combatBootstrapConfig(engine, tuneables);
  // Ensure opening-hand cards exist in the pile (equipment-only probes may be absent from starter).
  const deckIds = [...(base.deckIds ?? []), ...openingHand];
  const session = CombatSession.bootstrap(engine, { ...base, deckIds, openingHand });
  return { engine, session };
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

describe('COMBAT-F04 golden scenarios', () => {
  it('G1 baseline strike deals 8 through correction pipeline', () => {
    const { session } = createSession(['strike']);
    previewAndPlay(session, 'strike');
    expect(session.getSnapshot().enemies[0]!.health).toBe(4);
  });

  it('G2 weaken then strike deals 10 absorbed damage', () => {
    const { session } = createSession(['weaken', 'strike']);
    previewAndPlay(session, 'weaken');
    previewAndPlay(session, 'strike');
    expect(session.getSnapshot().enemies[0]!.health).toBe(2);
  });

  it('G3 heavy_blow buff then strike kills enemy (6 + 10 damage)', () => {
    const { session } = createSession(['heavy_blow', 'strike']);
    previewAndPlay(session, 'heavy_blow');
    previewAndPlay(session, 'strike');
    const snapshot = session.getSnapshot();
    expect(snapshot.enemies[0]!.health).toBe(0);
    expect(snapshot.result).toBe('victory');
  });

  it('G4 surge then strike deals 10', () => {
    const { session } = createSession(['surge', 'strike']);
    previewAndPlay(session, 'surge');
    previewAndPlay(session, 'strike');
    expect(session.getSnapshot().enemies[0]!.health).toBe(2);
  });

  it('G5 precise_cut deals 6 with offset', () => {
    const { session } = createSession(['precise_cut']);
    previewAndPlay(session, 'precise_cut');
    expect(session.getSnapshot().enemies[0]!.health).toBe(6);
  });

  it('G6 mend heals to max health cap', () => {
    const { engine, session } = createSession(['mend'], { playerStartHealth: 30 });
    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('Health', 22);
    previewAndPlay(session, 'mend', COMBAT_PLAYER_ID);
    expect(session.getSnapshot().player.health).toBe(30);
  });

  it('G7 mend does not overheal', () => {
    const { engine, session } = createSession(['mend'], { playerStartHealth: 30 });
    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('Health', 28);
    previewAndPlay(session, 'mend', COMBAT_PLAYER_ID);
    expect(session.getSnapshot().player.health).toBe(30);
  });

  it('turn start refills AP to MaxActionPoints', () => {
    const { session } = createSession(['wait']);
    previewAndPlay(session, 'wait');
    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().player.actionPoints).toBe(3);
  });
});
