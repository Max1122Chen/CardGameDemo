import { CombatSession, type CombatSnapshot } from '@cardgame/combat';
import {
  RuleEngine,
  TraceBuffer,
} from '@cardgame/core';

import { combatBootstrapConfig } from '../data/load-combat-bootstrap.js';

import { executeConsoleCommand } from '../console/console-executor.js';
import { applyOverlayToggle } from '../input/input-router.js';
import type {
  AppState,
  CombatPreviewView,
  EnemyView,
  EntityStatsView,
  HandCard,
  PrimaryStatsView,
  UiAction,
} from '../types.js';

function toPrimaryStatsView(
  primaries: NonNullable<CombatSnapshot['player']['primaries']>,
): PrimaryStatsView {
  return {
    strength: primaries.Strength,
    constitution: primaries.Constitution,
    dexterity: primaries.Dexterity,
    intelligence: primaries.Intelligence,
    wisdom: primaries.Wisdom,
    charisma: primaries.Charisma,
  };
}

function toEntityStatsView(actor: CombatSnapshot['player']): EntityStatsView | undefined {
  if (!actor.primaries) {
    return undefined;
  }
  return {
    health: actor.health,
    maxHealth: actor.maxHealth,
    block: actor.block,
    actionPoints: actor.actionPoints,
    maxActionPoints: actor.maxActionPoints,
    primaries: toPrimaryStatsView(actor.primaries),
    damageScaling: actor.damageScaling,
    damageMultiplier: actor.damageMultiplier,
    damageOffset: actor.damageOffset,
  };
}

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

  let combatSession = CombatSession.bootstrap(engine, combatBootstrapConfig(engine));

  const controller: SessionController = {
    engine,
    combatSession,
    traceLines: [],
    bootstrapBattle() {
      combatSession = CombatSession.bootstrap(engine, combatBootstrapConfig(engine));
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

      const preview = snapshot.preview;
      const enemies: EnemyView[] = snapshot.enemies.map((enemy) => ({
        id: enemy.entityId,
        name: enemy.name,
        health: enemy.health,
        block: enemy.block,
        intent: snapshot.enemyIntent?.label ?? 'Unknown',
        previewDamageToTake:
          preview && preview.targetEntityId === enemy.entityId ? preview.damageToTake : undefined,
      }));

      controller.traceLines = traceBuffer
        ? traceBuffer.entries.map((entry) => JSON.stringify(entry))
        : controller.traceLines;

      const combatLog = snapshot.combatLog.length > 0 ? snapshot.combatLog : state.combatLog;

      const previewView: CombatPreviewView | undefined = preview
        ? {
            handIndex: preview.handIndex,
            actionId: preview.actionId,
            targetEntityId: preview.targetEntityId,
            damage: preview.damage,
            damageToTake: preview.damageToTake,
            blockToGain: preview.blockToGain,
            damageBreakdown: preview.damageBreakdown,
          }
        : undefined;

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
        previewActive: previewView !== undefined,
        preview: previewView,
        playerStats: toEntityStatsView(snapshot.player),
        enemyStats: snapshot.enemies[0] ? toEntityStatsView(snapshot.enemies[0]) : undefined,
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

function previewStatusMessage(state: AppState): string {
  const preview = state.preview;
  if (!preview) {
    return state.statusMessage;
  }
  const card = state.hand[preview.handIndex];
  const name = card?.name ?? preview.actionId;
  if (preview.blockToGain !== undefined && preview.blockToGain > 0) {
    return `${name} preview: Block +${preview.blockToGain} (Space commit, Esc/x cancel)`;
  }
  if (preview.damageToTake !== undefined) {
    const breakdown = preview.damageBreakdown;
    const breakdownText = breakdown
      ? ` [${breakdown.panel}${breakdown.bonus >= 0 ? '+' : ''}${breakdown.bonus} ×${breakdown.scaling} ×${breakdown.multiplier} +${breakdown.offset} → ${breakdown.outgoing}]`
      : '';
    return `${name} preview: deal ${preview.damage ?? '?'} → absorb ${preview.damageToTake}${breakdownText} (Space commit, Esc/x cancel)`;
  }
  return `${name} preview active (Space commit, Esc/x cancel)`;
}

/** Recompute GFC preview from current UI selection. */
function refreshCardPreview(state: AppState, controller: SessionController): AppState {
  if (!isCombatInteractive(state) || state.hand.length === 0) {
    controller.combatSession.cancelCardPreview();
    return controller.syncViewState(state);
  }

  const enemy = state.enemies[state.selectedEnemyIndex];
  const targetId = enemy?.id;
  try {
    controller.combatSession.beginCardPreview(state.selectedHandIndex, targetId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed.';
    controller.combatSession.cancelCardPreview();
    return { ...controller.syncViewState(state), statusMessage: message };
  }

  const synced = controller.syncViewState(state);
  return { ...synced, statusMessage: previewStatusMessage(synced) };
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
    case 'close_stats_overlay':
      return { ...state, statsOverlay: 'none' };
    case 'toggle_player_stats':
      return {
        ...state,
        statsOverlay: state.statsOverlay === 'player' ? 'none' : 'player',
      };
    case 'toggle_enemy_stats':
      return {
        ...state,
        statsOverlay: state.statsOverlay === 'enemy' ? 'none' : 'enemy',
      };
    case 'toggle_trace_pane':
      return { ...state, showTracePane: !state.showTracePane };
    case 'quit':
      return { ...state, shouldQuit: true };
    case 'hand_prev': {
      const next = {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex - 1, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'hand_next': {
      const next = {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex + 1, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'enemy_prev': {
      const next = {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex - 1, state.enemies.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'enemy_next': {
      const next = {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex + 1, state.enemies.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'select_hand': {
      const next = {
        ...state,
        selectedHandIndex: clampIndex(action.index, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'cancel_card_preview': {
      if (!isCombatInteractive(state)) {
        return state;
      }
      controller.combatSession.cancelCardPreview();
      const synced = controller.syncViewState(state);
      return { ...synced, statusMessage: 'Card preview cancelled.' };
    }
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
        // Ensure preview matches selection, then commit.
        const enemy = state.enemies[state.selectedEnemyIndex];
        controller.combatSession.beginCardPreview(state.selectedHandIndex, enemy?.id);
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
      // After play, re-preview the (possibly new) selection for continuous UX.
      return refreshCardPreview({ ...synced, statusMessage: latestLog }, controller);
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
      return refreshCardPreview({ ...synced, statusMessage: latestLog }, controller);
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
