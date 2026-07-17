import type { GameplayFrameworkComponent } from '@cardgame/core';

import { computeAttributeBonusForEntity, type AttributeBonusConfig } from './attribute-bonus.js';
import type { CardDefinition } from './card-definition.js';
import {
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
  CARD_PLAY_STATUS_HANDLER_ID,
} from './card-play-handlers.js';
import { CombatAttributes } from './combat-attributes.js';
import { resetCombatMeta } from './take-damage.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';
import type { CardId } from './types.js';
import { COMBAT_ENEMY_ID, COMBAT_PLAYER_ID } from './types.js';

export function resolveEnemyPlayTarget(def: CardDefinition): string {
  switch (def.targeting) {
    case 'single_enemy':
      return COMBAT_PLAYER_ID;
    case 'self':
    case 'none':
      return COMBAT_ENEMY_ID;
  }
}

export function previewEnemyCardIntentLabel(args: {
  enemy: GameplayFrameworkComponent;
  player: GameplayFrameworkComponent;
  def: CardDefinition;
  abilityHandle: string;
  cardInstanceId: string;
  bonusConfig: AttributeBonusConfig;
}): string {
  const { enemy, player, def, abilityHandle, cardInstanceId, bonusConfig } = args;
  const targetId = resolveEnemyPlayTarget(def);
  const target = targetId === COMBAT_PLAYER_ID ? player : enemy;

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

  const activation = enemy.tryActivate(abilityHandle, {
    instigatorEntityId: COMBAT_ENEMY_ID,
    sourceEntityId: COMBAT_ENEMY_ID,
    targetEntityId: targetId,
    parameters: def.ability.parameterValues,
    payload: { cardInstanceId, actionId: def.id, cost: def.cost },
    setByCaller: Object.keys(setByCaller).length > 0 ? setByCaller : undefined,
  });

  if (!activation.ok) {
    return fallbackCardIntentLabel(def);
  }

  const handlerId = def.ability.handlerId;
  let label = def.name;

  if (handlerId === CARD_PLAY_DAMAGE_HANDLER_ID) {
    const outgoing = enemy.getAttribute(CombatAttributes.Damage)?.currentValue ?? 0;
    label = `Attack ${outgoing}`;
  } else if (handlerId === CARD_PLAY_BLOCK_HANDLER_ID) {
    const gain = enemy.getAttribute(CombatAttributes.BlockToGain)?.currentValue ?? 0;
    label = `Gain block ${gain}`;
  } else if (handlerId === CARD_PLAY_HEAL_HANDLER_ID) {
    const heal =
      typeof def.ability.parameterValues?.Heal === 'number' ? def.ability.parameterValues.Heal : 0;
    label = `Heal ${heal}`;
  } else {
    const damageToTake = target.getAttribute(CombatAttributes.DamageToTake)?.currentValue;
    if (damageToTake !== undefined && damageToTake > 0) {
      label = `${def.name} ${damageToTake}`;
    }
  }

  enemy.endAbility(activation.instanceId);
  resetCombatMeta(enemy);
  resetCombatMeta(player);

  return label;
}

/** Static label when preview cannot run (card not in hand, etc.). */
export function fallbackCardIntentLabel(def: CardDefinition): string {
  const handlerId = def.ability.handlerId;
  if (handlerId === CARD_PLAY_DAMAGE_HANDLER_ID) {
    const panel =
      typeof def.ability.parameterValues?.Damage === 'number'
        ? def.ability.parameterValues.Damage
        : 0;
    return `Attack ${panel}`;
  }
  if (handlerId === CARD_PLAY_BLOCK_HANDLER_ID) {
    const gain =
      typeof def.ability.parameterValues?.BlockToGain === 'number'
        ? def.ability.parameterValues.BlockToGain
        : 0;
    return `Gain block ${gain}`;
  }
  if (handlerId === CARD_PLAY_HEAL_HANDLER_ID) {
    const heal =
      typeof def.ability.parameterValues?.Heal === 'number' ? def.ability.parameterValues.Heal : 0;
    return `Heal ${heal}`;
  }
  if (handlerId === CARD_PLAY_STATUS_HANDLER_ID) {
    return def.name;
  }
  return def.name;
}

export function findEnemyHandInstanceId(
  cardId: CardId,
  hand: readonly string[],
  instances: ReadonlyMap<string, { actionId: CardId }>,
): string | undefined {
  return hand.find((instanceId) => instances.get(instanceId)?.actionId === cardId);
}
