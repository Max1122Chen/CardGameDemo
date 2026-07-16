import { describe, expect, it } from 'vitest';

import { RuleEngine } from '@cardgame/core';
import { TraceBuffer } from '@cardgame/core';
import { CombatError, CombatSession } from './combat-session.js';
import { combatBootstrapConfig } from './data/combat-bootstrap.js';
import { drawCards, buildDeckInstances } from './deck-state.js';
import type { CardActionId, CombatSessionTuneables } from './types.js';
import { COMBAT_ENEMY_ID, COMBAT_PLAYER_ID } from './types.js';

function createSession(
  options: Partial<CombatSessionTuneables> | boolean = {},
): { engine: RuleEngine; session: CombatSession; traceBuffer?: TraceBuffer } {
  const trace = typeof options === 'boolean' ? options : false;
  const tuneables = typeof options === 'boolean' ? {} : options;
  const traceBuffer = trace ? new TraceBuffer() : undefined;
  const engine = RuleEngine.create({ traceSink: traceBuffer });
  const session = CombatSession.bootstrap(engine, combatBootstrapConfig(engine, tuneables));
  return { engine, session, traceBuffer };
}

function handIndex(session: CombatSession, actionId: CardActionId): number {
  const snapshot = session.getSnapshot();
  const index = snapshot.hand.findIndex((card) => card.actionId === actionId);
  if (index < 0) {
    throw new Error(`Card ${actionId} not in hand`);
  }
  return index;
}

function playCard(session: CombatSession, actionId: CardActionId): void {
  session.applyAction({ type: 'PlayCard', handIndex: handIndex(session, actionId) });
}

describe('CombatSession', () => {
  it('setup creates player and enemy with expected attributes', () => {
    const { engine, session } = createSession();
    const snapshot = session.getSnapshot();

    expect(snapshot.phase).toBe('PlayerTurn');
    expect(snapshot.turnOwner).toBe('player');
    expect(snapshot.player.health).toBe(30);
    expect(snapshot.player.block).toBe(0);
    expect(snapshot.player.actionPoints).toBe(3);
    expect(snapshot.enemies[0]).toMatchObject({
      entityId: COMBAT_ENEMY_ID,
      name: 'Slime',
      health: 12,
    });
    expect(engine.getGfc(COMBAT_PLAYER_ID)).toBeDefined();
    expect(engine.getGfc(COMBAT_ENEMY_ID)).toBeDefined();
  });

  it('opening hand size is correct', () => {
    const { session } = createSession();
    expect(session.getSnapshot().hand).toHaveLength(5);
  });

  it('turn start refills AP and draws turnDraw cards', () => {
    const { session } = createSession({ turnDraw: 1 });

    playCard(session, 'strike');
    expect(session.getSnapshot().player.actionPoints).toBe(2);

    session.applyAction({ type: 'EndTurn' });
    expect(session.getSnapshot().phase).toBe('PlayerTurn');
    expect(session.getSnapshot().player.actionPoints).toBe(3);
    expect(session.getSnapshot().hand).toHaveLength(1);
  });

  it('PlayCard spends AP and applies effect', () => {
    const { session } = createSession();
    const beforeEnemyHp = session.getSnapshot().enemies[0].health;

    playCard(session, 'strike');

    const snapshot = session.getSnapshot();
    expect(snapshot.player.actionPoints).toBe(2);
    expect(snapshot.enemies[0].health).toBe(beforeEnemyHp - 8);
  });

  it('insufficient AP rejects play', () => {
    const { engine, session } = createSession();

    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('ActionPoints', 0);

    expect(() => session.applyAction({ type: 'PlayCard', handIndex: 0 })).toThrow(CombatError);
    expect(session.getSnapshot().result).toBeUndefined();
  });

  it('EndTurn discards hand and switches to enemy turn before returning to player', () => {
    const { session } = createSession({ turnDraw: 1 });
    const handBefore = session.getSnapshot().hand.length;
    expect(handBefore).toBeGreaterThan(0);

    session.applyAction({ type: 'EndTurn' });

    const snapshot = session.getSnapshot();
    expect(snapshot.phase).toBe('PlayerTurn');
    expect(snapshot.hand.length).toBeLessThan(handBefore);
    expect(snapshot.combatLog.some((line) => line.includes('Slime attacked'))).toBe(true);
  });

  it('enemy turn deals damage through block-first rule', () => {
    const { session } = createSession();

    playCard(session, 'defend');
    session.applyAction({ type: 'EndTurn' });

    const snapshot = session.getSnapshot();
    expect(snapshot.player.block).toBe(0);
    expect(snapshot.player.health).toBe(29);
  });

  it('victory when enemy HP reaches 0', () => {
    const { session } = createSession({ openingHand: ['bash', 'strike'] });

    playCard(session, 'bash');
    playCard(session, 'strike');

    const snapshot = session.getSnapshot();
    expect(snapshot.result).toBe('victory');
    expect(snapshot.phase).toBe('Victory');
    expect(snapshot.enemies[0].health).toBe(0);
    expect(() => session.applyAction({ type: 'EndTurn' })).toThrow(CombatError);
  });

  it('defeat when player HP reaches 0', () => {
    const { engine, session } = createSession();
    engine.requireGfc(COMBAT_PLAYER_ID).setAttributeBase('Health', 1);

    session.applyAction({ type: 'EndTurn' });

    const snapshot = session.getSnapshot();
    expect(snapshot.result).toBe('defeat');
    expect(snapshot.phase).toBe('Defeat');
    expect(snapshot.player.health).toBe(0);
  });

  it('empty draw pile triggers shuffle-from-discard', () => {
    const engine = RuleEngine.create();
    const { deckIds } = combatBootstrapConfig(engine);
    const { deck } = buildDeckInstances(deckIds);
    deck.drawPile.length = 0;
    deck.discardPile.push('card-1', 'card-3', 'card-5');

    drawCards(deck, 2);

    expect(deck.drawPile).toHaveLength(1);
    expect(deck.hand).toHaveLength(2);
    expect(deck.discardPile).toHaveLength(0);
  });

  it('emits combat trace entries for major transitions', () => {
    const { session, traceBuffer } = createSession(true);

    playCard(session, 'strike');
    session.applyAction({ type: 'EndTurn' });

    const kinds = traceBuffer?.entries.map((entry) => entry.kind) ?? [];
    expect(kinds).toContain('combat.turn');
    expect(kinds).toContain('combat.play_card');
    expect(kinds).toContain('combat.damage');
    expect(kinds).toContain('combat.draw');
  });

  it('card preview sets DamageToTake and cancel clears meta without HP loss', () => {
    const { engine, session } = createSession();
    const enemy = engine.requireGfc(COMBAT_ENEMY_ID);
    const beforeHp = enemy.getAttribute('Health')?.currentValue ?? 0;

    session.beginCardPreview(handIndex(session, 'strike'), COMBAT_ENEMY_ID);

    expect(enemy.getAttribute('DamageToTake')?.currentValue).toBe(8);
    expect(enemy.getAttribute('Health')?.currentValue).toBe(beforeHp);

    session.cancelCardPreview();

    expect(enemy.getAttribute('DamageToTake')?.currentValue).toBe(0);
    expect(enemy.getAttribute('Health')?.currentValue).toBe(beforeHp);
  });
});
