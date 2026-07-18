import { describe, expect, it } from 'vitest';

import { createBootstrappedShell, handleKeypress } from '../app-shell.js';
import { createInitialAppState } from '../input/input-router.js';
import { parseKeypress } from '../input/key-events.js';
import { applyUiAction, createSessionController } from '../session/session-controller.js';

describe('session-controller combat integration', () => {
  it('plays a card through CombatSession', () => {
    const controller = createSessionController({});
    let state = controller.syncViewState(createInitialAppState({ runtimeMode: 'battle' }));
    const enemyHpBefore = state.enemies[0]?.health ?? 0;

    state = applyUiAction(state, controller, { type: 'play_selected_card' });

    expect(state.enemies[0]?.health).toBeLessThan(enemyHpBefore);
    expect(state.actionPoints).toBe(2);
  });

  it('EndTurn advances combat and returns to player turn', () => {
    const controller = createSessionController({});
    let state = controller.syncViewState(createInitialAppState({ runtimeMode: 'battle' }));

    state = applyUiAction(state, controller, { type: 'end_turn' });

    expect(state.combatPhase).toBe('PlayerTurn');
    expect(state.turnOwner).toBe('player');
    expect(state.combatLog.some((line) => line.includes('Defend played'))).toBe(true);
  });

  it('displays combat result when battle ends', () => {
    const controller = createSessionController({ enemyHealthOverride: 12 });
    let state = controller.syncViewState(createInitialAppState({ runtimeMode: 'battle' }));

    const strikeIndex = controller.getCombatSnapshot().hand.findIndex((card) => card.actionId === 'strike');
    expect(strikeIndex).toBeGreaterThanOrEqual(0);

    state = { ...state, selectedHandIndex: strikeIndex };
    state = applyUiAction(state, controller, { type: 'play_selected_card' });
    state = applyUiAction(state, controller, { type: 'play_selected_card' });

    expect(state.combatResult).toBe('victory');
    expect(state.combatPhase).toBe('Victory');
  });

  it('selecting a strike card previews DamageToTake on the enemy', () => {
    const controller = createSessionController({});
    let state = controller.syncViewState(createInitialAppState({ runtimeMode: 'battle' }));
    const strikeIndex = controller.getCombatSnapshot().hand.findIndex((card) => card.actionId === 'strike');
    expect(strikeIndex).toBeGreaterThanOrEqual(0);

    state = applyUiAction(state, controller, { type: 'select_hand', index: strikeIndex });

    expect(state.previewActive).toBe(true);
    expect(state.preview?.damageToTake).toBe(8);
    expect(state.enemies[0]?.previewDamageToTake).toBe(8);

    const hpBefore = state.enemies[0]?.health ?? 0;
    state = applyUiAction(state, controller, { type: 'cancel_card_preview' });

    expect(state.previewActive).toBe(false);
    expect(state.enemies[0]?.health).toBe(hpBefore);
    expect(state.enemies[0]?.previewDamageToTake).toBeUndefined();
  });
});

describe('explore interact keys', () => {
  it('i enters interact pick mode on level.probe', () => {
    const { controller, state: boot } = createBootstrappedShell({
      mode: 'dungeon',
      levelId: 'level.probe',
    });
    const state = handleKeypress(boot, controller, parseKeypress('i'));
    expect(state.interactPickMode).toBe(true);
    expect(state.statusMessage).toMatch(/Interact/i);
  });

  it('keeps end-round error visible while pending combat', () => {
    const { controller, state: boot } = createBootstrappedShell({
      mode: 'dungeon',
      levelId: 'level.probe',
    });
    let state = handleKeypress(boot, controller, parseKeypress('d'));
    expect(state.pendingCombat).toBe(true);
    state = handleKeypress(state, controller, parseKeypress('f'));
    expect(state.statusMessage).toMatch(/Confirm combat before ending round/i);
  });
});
