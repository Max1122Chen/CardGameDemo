import {
  CombatSession,
  RuleEngine,
  TraceBuffer,
  type CombatSnapshot,
} from '@cardgame/core';

import { executeConsoleCommand } from '../console/console-executor.js';
import { applyOverlayToggle } from '../input/input-router.js';
import type { AppState, EnemyView, HandCard, UiAction } from '../types.js';

export type SessionController = {
  engine: RuleEngine;
  combatSession: CombatSession;
  traceLines: string[];
  bootstrapBattle: () => void;
  syncViewState: (state: AppState) => AppState;
  getCombatSnapshot: () => CombatSnapshot;
};

export function createSessionController(options: {
  seed?: number;
  scenarioId?: string;
  traceToBuffer?: boolean;
}): SessionController {
  const traceBuffer = options.traceToBuffer ? new TraceBuffer() : undefined;
  const engine = RuleEngine.create({
    traceSink: traceBuffer,
  });

  let combatSession = CombatSession.bootstrap(engine);

  const controller: SessionController = {
    engine,
    combatSession,
    traceLines: [],
    bootstrapBattle() {
      combatSession = CombatSession.bootstrap(engine);
      controller.combatSession = combatSession;
    },
    getCombatSnapshot() {
      return combatSession.getSnapshot();
    },
    syncViewState(state) {
      const snapshot = combatSession.getSnapshot();

      const hand: HandCard[] = snapshot.hand.map((card) => ({
        id: card.actionId,
        name: card.name,
        cost: card.cost,
      }));

      const enemies: EnemyView[] = snapshot.enemies.map((enemy) => ({
        id: enemy.entityId,
        name: enemy.name,
        health: enemy.health,
        intent: snapshot.enemyIntent?.label ?? 'Unknown',
      }));

      controller.traceLines = traceBuffer
        ? traceBuffer.entries.map((entry) => JSON.stringify(entry))
        : controller.traceLines;

      const combatLog = snapshot.combatLog.length > 0 ? snapshot.combatLog : state.combatLog;

      return {
        ...state,
        hand,
        enemies,
        playerHealth: snapshot.player.health,
        playerBlock: snapshot.player.block,
        actionPoints: snapshot.player.actionPoints ?? 0,
        combatPhase: snapshot.phase,
        turnOwner: snapshot.turnOwner,
        combatResult: snapshot.result,
        combatLog,
        selectedHandIndex: Math.min(state.selectedHandIndex, Math.max(0, hand.length - 1)),
        selectedEnemyIndex: Math.min(state.selectedEnemyIndex, Math.max(0, enemies.length - 1)),
      };
    },
  };

  return controller;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

function pushLog(state: AppState, line: string): AppState {
  const combatLog = [...state.combatLog, line];
  if (combatLog.length > 8) {
    combatLog.shift();
  }
  return { ...state, combatLog, statusMessage: line };
}

function isCombatInteractive(state: AppState): boolean {
  return state.combatPhase === 'PlayerTurn' && !state.combatResult;
}

export function applyUiAction(
  state: AppState,
  controller: SessionController,
  action: UiAction,
): AppState {
  switch (action.type) {
    case 'toggle_inventory':
      return applyOverlayToggle(state, 'inventory');
    case 'toggle_settings':
      return applyOverlayToggle(state, 'settings');
    case 'toggle_console':
      return applyOverlayToggle(state, 'console');
    case 'close_overlay':
      return {
        ...state,
        overlay: 'none',
        focusLayer: 'gameplay',
      };
    case 'toggle_trace_pane':
      return { ...state, showTracePane: !state.showTracePane };
    case 'quit':
      return { ...state, shouldQuit: true };
    case 'hand_prev':
      return {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex - 1, state.hand.length),
        statusMessage: 'Selected previous card.',
      };
    case 'hand_next':
      return {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex + 1, state.hand.length),
        statusMessage: 'Selected next card.',
      };
    case 'enemy_prev':
      return {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex - 1, state.enemies.length),
        statusMessage: 'Selected previous enemy.',
      };
    case 'enemy_next':
      return {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex + 1, state.enemies.length),
        statusMessage: 'Selected next enemy.',
      };
    case 'select_hand':
      return {
        ...state,
        selectedHandIndex: clampIndex(action.index, state.hand.length),
        statusMessage: `Selected card slot ${action.index + 1}.`,
      };
    case 'play_selected_card': {
      if (!isCombatInteractive(state)) {
        return pushLog(state, state.combatResult ? `Combat ended: ${state.combatResult}.` : 'Not your turn.');
      }

      const card = state.hand[state.selectedHandIndex];
      if (!card) {
        return pushLog(state, 'No card selected.');
      }

      const legal = controller.combatSession.legalActions();
      const canPlay = legal.some(
        (candidate) => candidate.type === 'PlayCard' && candidate.handIndex === state.selectedHandIndex,
      );
      if (!canPlay) {
        return pushLog(state, `Cannot play ${card.name}.`);
      }

      try {
        controller.combatSession.applyAction({
          type: 'PlayCard',
          handIndex: state.selectedHandIndex,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to play card.';
        return pushLog(state, message);
      }

      const synced = controller.syncViewState(state);
      const latestLog = synced.combatLog[synced.combatLog.length - 1] ?? `Played ${card.name}.`;
      return { ...synced, statusMessage: latestLog };
    }
    case 'end_turn': {
      if (!isCombatInteractive(state)) {
        return pushLog(state, state.combatResult ? `Combat ended: ${state.combatResult}.` : 'Not your turn.');
      }

      try {
        controller.combatSession.applyAction({ type: 'EndTurn' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to end turn.';
        return pushLog(state, message);
      }

      const synced = controller.syncViewState(state);
      const latestLog = synced.combatLog[synced.combatLog.length - 1] ?? 'Ended turn.';
      return { ...synced, statusMessage: latestLog };
    }
    case 'console_append':
      return { ...state, consoleInput: `${state.consoleInput}${action.char}` };
    case 'console_backspace':
      return { ...state, consoleInput: state.consoleInput.slice(0, -1) };
    case 'console_submit': {
      const input = state.consoleInput.trim();
      if (!input) {
        return state;
      }

      const result = executeConsoleCommand(controller, input);
      const consoleScrollback = [...state.consoleScrollback, `> ${input}`, ...result.lines];
      while (consoleScrollback.length > 20) {
        consoleScrollback.shift();
      }

      return {
        ...controller.syncViewState(state),
        consoleInput: '',
        consoleScrollback,
        statusMessage: result.statusMessage,
      };
    }
    default:
      return state;
  }
}

export function applyUiActions(
  state: AppState,
  controller: SessionController,
  actions: readonly UiAction[],
): AppState {
  return actions.reduce((next, action) => applyUiAction(next, controller, action), state);
}
