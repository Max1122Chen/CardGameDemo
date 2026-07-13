import { RuleEngine, TraceBuffer, createGameplayEvent } from '@cardgame/core';

import { executeConsoleCommand } from '../console/console-executor.js';
import { applyOverlayToggle } from '../input/input-router.js';
import type { AppState, EnemyView, HandCard, UiAction } from '../types.js';

export type SessionController = {
  engine: RuleEngine;
  traceLines: string[];
  bootstrapBattle: () => void;
  syncViewState: (state: AppState) => AppState;
};

const DEFAULT_HAND: HandCard[] = [
  { id: 'strike', name: 'Strike', cost: 1 },
  { id: 'defend', name: 'Defend', cost: 1 },
  { id: 'bash', name: 'Bash', cost: 2 },
];

export function createSessionController(options: {
  seed?: number;
  scenarioId?: string;
  traceToBuffer?: boolean;
}): SessionController {
  const traceBuffer = options.traceToBuffer ? new TraceBuffer() : undefined;
  const engine = RuleEngine.create({
    traceSink: traceBuffer,
  });

  const controller: SessionController = {
    engine,
    traceLines: [],
    bootstrapBattle() {
      const player = engine.createEntityWithGfc('player');
      const enemy = engine.createEntityWithGfc('enemy-1');

      player.setAttributeBase('Health', 30);
      player.setAttributeBase('Block', 0);
      player.setAttributeBase('ActionPoints', 3);
      enemy.setAttributeBase('Health', 12);

      engine.eventSystem.dispatch(
        createGameplayEvent(engine.tagManager, {
          tags: [engine.tagManager.resolve('GameplayEvent.Combat')],
          payload: {
            phase: 'turn_start',
            seed: options.seed,
            scenarioId: options.scenarioId,
          },
        }),
      );
    },
    syncViewState(state) {
      const player = engine.getGfc('player');
      const enemy = engine.getGfc('enemy-1');

      const enemies: EnemyView[] = enemy
        ? [
            {
              id: 'enemy-1',
              name: 'Slime',
              health: enemy.getAttribute('Health')?.currentValue ?? 0,
              intent: 'Attack 6',
            },
          ]
        : [];

      controller.traceLines = traceBuffer
        ? traceBuffer.entries.map((entry) => JSON.stringify(entry))
        : controller.traceLines;

      return {
        ...state,
        hand: state.hand.length > 0 ? state.hand : DEFAULT_HAND,
        enemies,
        playerHealth: player?.getAttribute('Health')?.currentValue ?? 0,
        playerBlock: player?.getAttribute('Block')?.currentValue ?? 0,
        actionPoints: player?.getAttribute('ActionPoints')?.currentValue ?? 0,
      };
    },
  };

  controller.bootstrapBattle();
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
      const card = state.hand[state.selectedHandIndex];
      if (!card) {
        return pushLog(state, 'No card selected.');
      }
      if (state.actionPoints < card.cost) {
        return pushLog(state, `Not enough AP for ${card.name}.`);
      }

      const player = controller.engine.getGfc('player');
      const enemy = controller.engine.getGfc('enemy-1');
      if (!player || !enemy) {
        return pushLog(state, 'Battle session is not ready.');
      }

      const ap = player.getAttribute('ActionPoints');
      if (ap) {
        player.setAttributeBase('ActionPoints', ap.baseValue - card.cost);
      }

      if (card.id === 'strike' || card.id === 'bash') {
        const enemyHealth = enemy.getAttribute('Health');
        const damage = card.id === 'bash' ? 8 : 6;
        if (enemyHealth) {
          enemy.setAttributeBase('Health', Math.max(0, enemyHealth.baseValue - damage));
        }
        controller.engine.eventSystem.dispatch(
          createGameplayEvent(controller.engine.tagManager, {
            tags: [controller.engine.tagManager.resolve('GameplayEvent.Combat')],
            payload: { card: card.id, damage, targetId: 'enemy-1' },
          }),
        );
        return pushLog(controller.syncViewState(state), `Played ${card.name} for ${damage} damage.`);
      }

      const block = player.getAttribute('Block');
      const gained = 5;
      if (block) {
        player.setAttributeBase('Block', block.baseValue + gained);
      }
      return pushLog(controller.syncViewState(state), `Played ${card.name} and gained ${gained} block.`);
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
