import type { GameplayAbilityDefinition } from '../ga/types.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import { CombatAttributes } from './combat-attributes.js';
import type { CardActionId } from './types.js';
import { getCardSpec } from './card-catalog.js';

const TRY_OR_CANCEL_TAGS = [
  'GameplayEvent.Combat.TryPlayCard',
  'GameplayEvent.Combat.CancelPlayCard',
] as const;

function damageFaceEffect(cardId: CardActionId, amount: number): GameplayEffectDefinition {
  return {
    id: `ge.card.${cardId}.damage-face`,
    duration: { kind: 'Instant' },
    modifiers: [{ attribute: CombatAttributes.Damage, op: 'Override', magnitude: amount }],
  };
}

function feedDamageToTakeEffect(cardId: CardActionId): GameplayEffectDefinition {
  return {
    id: `ge.card.${cardId}.feed-damage-to-take`,
    duration: { kind: 'Instant' },
    modifiers: [
      {
        attribute: CombatAttributes.DamageToTake,
        op: 'Override',
        magnitude: {
          kind: 'AttributeBased',
          captureFrom: 'Source',
          attribute: CombatAttributes.Damage,
          valueKind: 'Current',
        },
      },
    ],
  };
}

function blockToGainEffect(cardId: CardActionId, amount: number): GameplayEffectDefinition {
  return {
    id: `ge.card.${cardId}.block-to-gain`,
    duration: { kind: 'Instant' },
    modifiers: [{ attribute: CombatAttributes.BlockToGain, op: 'Override', magnitude: amount }],
  };
}

/** Card GA: preview on activate, wait for TryPlayCard / CancelPlayCard. */
export function createCardAbilityDefinition(actionId: CardActionId): GameplayAbilityDefinition {
  const spec = getCardSpec(actionId);

  if (spec.damage !== undefined) {
    return {
      id: `ga.card.${actionId}`,
      kind: 'active',
      name: spec.name,
      tags: { abilityTags: [`Card.${actionId}`] },
      chargeCostOnActivate: false,
      endPolicy: 'manual',
      effectsOnActivate: [
        { target: 'self', effect: damageFaceEffect(actionId, spec.damage) },
        { target: 'target', effect: feedDamageToTakeEffect(actionId) },
      ],
      listenWhileActive: {
        channelTag: 'Combat',
        eventTags: [...TRY_OR_CANCEL_TAGS],
        match: 'any',
      },
    };
  }

  if (spec.block !== undefined) {
    return {
      id: `ga.card.${actionId}`,
      kind: 'active',
      name: spec.name,
      tags: { abilityTags: [`Card.${actionId}`] },
      chargeCostOnActivate: false,
      endPolicy: 'manual',
      effectsOnActivate: [{ target: 'self', effect: blockToGainEffect(actionId, spec.block) }],
      listenWhileActive: {
        channelTag: 'Combat',
        eventTags: [...TRY_OR_CANCEL_TAGS],
        match: 'any',
      },
    };
  }

  throw new Error(`Unsupported card for GA: ${actionId}`);
}

export function spendActionPointsEffect(amount: number): GameplayEffectDefinition {
  return {
    id: 'ge.combat.spend-ap',
    duration: { kind: 'Instant' },
    modifiers: [{ attribute: CombatAttributes.ActionPoints, op: 'Add', magnitude: -amount }],
  };
}

export function gainBlockFromPreviewEffect(): GameplayEffectDefinition {
  return {
    id: 'ge.combat.commit-block',
    duration: { kind: 'Instant' },
    modifiers: [
      {
        attribute: CombatAttributes.Block,
        op: 'Add',
        magnitude: {
          kind: 'AttributeBased',
          captureFrom: 'Source',
          attribute: CombatAttributes.BlockToGain,
          valueKind: 'Current',
        },
      },
    ],
  };
}
