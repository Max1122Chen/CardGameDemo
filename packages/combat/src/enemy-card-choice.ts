import type { GameplayFrameworkComponent } from '@cardgame/core';

import { computeAttributeBonusForEntity, type AttributeBonusConfig } from './attribute-bonus.js';
import type { CardDefinition } from './card-definition.js';
import {
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
} from './card-play-handlers.js';
import { CombatAttributes } from './combat-attributes.js';
import { getEntityActionPoints } from './combat-damage.js';
import { resolveEnemyPlayTarget } from './enemy-intent-preview.js';
import { resetCombatMeta } from './combat-entity-bootstrap.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';
import type { CardId } from './types.js';
import { COMBAT_ENEMY_ID } from './types.js';

export type EnemyCardGoal = 'damage' | 'block' | 'finisher';

export type EnemyCardChoice = {
  cardId: CardId;
  instanceId: string;
  score: number;
  cost: number;
};

export function chooseBestEnemyCard(args: {
  goal: EnemyCardGoal;
  enemy: GameplayFrameworkComponent;
  player: GameplayFrameworkComponent;
  hand: readonly string[];
  instances: ReadonlyMap<string, { actionId: CardId }>;
  cardDefinitions: Record<CardId, CardDefinition>;
  abilityHandles: ReadonlyMap<CardId, string>;
  bonusConfig: AttributeBonusConfig;
}): EnemyCardChoice | undefined {
  let best: EnemyCardChoice | undefined;

  for (const instanceId of args.hand) {
    const instance = args.instances.get(instanceId);
    if (!instance) {
      continue;
    }

    const scored = scoreEnemyHandCard({
      ...args,
      instanceId,
      actionId: instance.actionId,
    });
    if (!scored) {
      continue;
    }

    if (!best || isBetterEnemyCardChoice(args.goal, scored, best)) {
      best = scored;
    }
  }

  return best;
}

function isBetterEnemyCardChoice(
  goal: EnemyCardGoal,
  candidate: EnemyCardChoice,
  current: EnemyCardChoice,
): boolean {
  if (candidate.score > current.score) {
    return true;
  }
  if (candidate.score < current.score) {
    return false;
  }
  if (goal === 'finisher' && candidate.cost !== current.cost) {
    return candidate.cost > current.cost;
  }
  return false;
}

function scoreEnemyHandCard(args: {
  goal: EnemyCardGoal;
  enemy: GameplayFrameworkComponent;
  player: GameplayFrameworkComponent;
  instanceId: string;
  actionId: CardId;
  cardDefinitions: Record<CardId, CardDefinition>;
  abilityHandles: ReadonlyMap<CardId, string>;
  bonusConfig: AttributeBonusConfig;
}): EnemyCardChoice | undefined {
  const def = args.cardDefinitions[args.actionId];
  if (!def) {
    return undefined;
  }

  if (getEntityActionPoints(args.enemy) < def.cost) {
    return undefined;
  }

  const handle = args.abilityHandles.get(args.actionId);
  if (!handle) {
    return undefined;
  }

  const score = previewEnemyCardScore({
    goal: args.goal,
    enemy: args.enemy,
    player: args.player,
    def,
    handle,
    instanceId: args.instanceId,
    bonusConfig: args.bonusConfig,
  });
  if (score === undefined) {
    return undefined;
  }

  return {
    cardId: args.actionId,
    instanceId: args.instanceId,
    score,
    cost: def.cost,
  };
}

function previewEnemyCardScore(args: {
  goal: EnemyCardGoal;
  enemy: GameplayFrameworkComponent;
  player: GameplayFrameworkComponent;
  def: CardDefinition;
  handle: string;
  instanceId: string;
  bonusConfig: AttributeBonusConfig;
}): number | undefined {
  const { enemy, player, def, handle, instanceId, bonusConfig, goal } = args;
  const targetId = resolveEnemyPlayTarget(def);

  resetCombatMeta(enemy);
  resetCombatMeta(player);

  const setByCaller: Record<string, number> = {};
  if (def.attributeBonus) {
    setByCaller[SetByCallerKeys.AttributeBonus] = computeAttributeBonusForEntity(
      def.attributeBonus,
      enemy,
      bonusConfig,
    );
  }

  const activation = enemy.tryActivate(handle, {
    instigatorEntityId: COMBAT_ENEMY_ID,
    sourceEntityId: COMBAT_ENEMY_ID,
    targetEntityId: targetId,
    parameters: def.ability.parameterValues,
    payload: { cardInstanceId: instanceId, actionId: def.id, cost: def.cost },
    setByCaller: Object.keys(setByCaller).length > 0 ? setByCaller : undefined,
  });

  if (!activation.ok) {
    resetCombatMeta(enemy);
    resetCombatMeta(player);
    return undefined;
  }

  const handlerId = def.ability.handlerId;
  let score: number | undefined;

  if (goal === 'block') {
    if (handlerId !== CARD_PLAY_BLOCK_HANDLER_ID) {
      score = undefined;
    } else {
      score = enemy.getAttribute(CombatAttributes.BlockToGain)?.currentValue ?? 0;
    }
  } else if (handlerId === CARD_PLAY_DAMAGE_HANDLER_ID) {
    score = enemy.getAttribute(CombatAttributes.Damage)?.currentValue ?? 0;
  } else if (handlerId === CARD_PLAY_HEAL_HANDLER_ID) {
    score =
      typeof def.ability.parameterValues?.Heal === 'number'
        ? def.ability.parameterValues.Heal
        : 0;
  } else {
    score = undefined;
  }

  enemy.endAbility(activation.instanceId);
  resetCombatMeta(enemy);
  resetCombatMeta(player);

  return score;
}
