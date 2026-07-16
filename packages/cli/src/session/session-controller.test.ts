import { describe, expect, it } from 'vitest';

import { applyUiAction, createSessionController } from '../session/session-controller.js';
import { createInitialAppState } from '../input/input-router.js';

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
    expect(state.combatLog.some((line) => line.includes('Slime attacked'))).toBe(true);
  });

  it('displays combat result when battle ends', () => {
    const controller = createSessionController({});
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
