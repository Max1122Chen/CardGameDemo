import type { Blackboard } from '@cardgame/core';
import type { BehaviorTreeRunState } from '@cardgame/core';
import type { BtNode } from '@cardgame/core';

import type { EnemyCardGoal } from './enemy-card-choice.js';
import {
  evaluateEnemyWhenCondition,
  type EnemyWhenCondition,
} from './enemy-blackboard.js';
import type { CardId } from './types.js';

type BtTaskNode = Extract<BtNode, { type: 'Task' }>;

export type EnemyPeekContext = {
  blackboard: Blackboard;
  isCardPlayable: (cardId: CardId) => boolean;
  resolvePlayBestCard: (goal: EnemyCardGoal) => CardId | undefined;
};

export function peekNextTaskNode(
  root: BtNode,
  state: BehaviorTreeRunState,
  peekCtx?: EnemyPeekContext,
): BtTaskNode | undefined {
  return walkPeek(root, state, peekCtx, false);
}

function walkPeek(
  node: BtNode,
  state: BehaviorTreeRunState,
  peekCtx?: EnemyPeekContext,
  underSequence = false,
): BtTaskNode | undefined {
  switch (node.type) {
    case 'Task':
      return resolvePeekTask(node, peekCtx, !underSequence);
    case 'Wait':
      return undefined;
    case 'BlackboardCompare':
      if (!peekCtx || !evaluateBlackboardCompare(node, peekCtx.blackboard)) {
        return undefined;
      }
      return undefined;
    case 'Sequence': {
      let index = state.sequenceIndex.get(node) ?? 0;
      while (index < node.children.length) {
        const child = node.children[index]!;
        if (child.type === 'BlackboardCompare') {
          if (!peekCtx || !evaluateBlackboardCompare(child, peekCtx.blackboard)) {
            return undefined;
          }
          index += 1;
          continue;
        }
        return walkPeek(child, state, peekCtx, true);
      }
      return undefined;
    }
    case 'Selector': {
      const startIndex = peekCtx ? 0 : (state.selectorIndex.get(node) ?? 0);
      for (let index = startIndex; index < node.children.length; index += 1) {
        const task = walkPeek(node.children[index]!, state, peekCtx, false);
        if (task) {
          return task;
        }
      }
      return undefined;
    }
    case 'Repeat':
      return walkPeek(node.child, state, peekCtx, underSequence);
    case 'Inverter':
    case 'Succeed':
    case 'Fail':
      return walkPeek(node.child, state, peekCtx, underSequence);
    default:
      return undefined;
  }
}

function evaluateBlackboardCompare(
  node: Extract<BtNode, { type: 'BlackboardCompare' }>,
  blackboard: Blackboard,
): boolean {
  const actual = blackboard.get(node.key);
  switch (node.op) {
    case 'eq':
      return actual === node.value;
    case 'ne':
      return actual !== node.value;
    case 'gt':
      return typeof actual === 'number' && typeof node.value === 'number' && actual > node.value;
    case 'gte':
      return typeof actual === 'number' && typeof node.value === 'number' && actual >= node.value;
    case 'lt':
      return typeof actual === 'number' && typeof node.value === 'number' && actual < node.value;
    case 'lte':
      return typeof actual === 'number' && typeof node.value === 'number' && actual <= node.value;
    default:
      return false;
  }
}

function resolvePeekTask(
  node: BtTaskNode,
  peekCtx?: EnemyPeekContext,
  requirePlayable = true,
): BtTaskNode | undefined {
  if (!peekCtx) {
    return node;
  }

  const when = parseWhenParam(node.params);
  if (when && !evaluateEnemyWhenCondition(peekCtx.blackboard, when)) {
    return undefined;
  }

  if (node.actionId === 'combat.playCard' || node.actionId === 'combat.playCardIf') {
    const cardId = typeof node.params?.cardId === 'string' ? node.params.cardId : '';
    if (!cardId) {
      return undefined;
    }
    if (requirePlayable && !peekCtx.isCardPlayable(cardId)) {
      return undefined;
    }
    return { type: 'Task', actionId: 'combat.playCard', params: { cardId } };
  }

  if (node.actionId === 'combat.playBestCard') {
    const goal = parseGoalParam(node.params);
    if (!goal) {
      return undefined;
    }
    const cardId = peekCtx.resolvePlayBestCard(goal);
    if (!cardId) {
      return undefined;
    }
    return { type: 'Task', actionId: 'combat.playCard', params: { cardId } };
  }

  if (node.actionId === 'combat.wait' || node.actionId === 'combat.endTurn') {
    return node;
  }

  return node;
}

function parseWhenParam(params?: Record<string, unknown>): EnemyWhenCondition | undefined {
  const when = params?.when;
  if (when === 'selfLowHp' || when === 'playerLowHp') {
    return when;
  }
  return undefined;
}

function parseGoalParam(params?: Record<string, unknown>): EnemyCardGoal | undefined {
  const goal = params?.goal;
  if (goal === 'damage' || goal === 'block' || goal === 'finisher') {
    return goal;
  }
  return undefined;
}
