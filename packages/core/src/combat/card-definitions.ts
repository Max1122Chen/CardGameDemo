import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { CardDefinition } from './card-definition.js';
import { CombatAttributes } from './combat-attributes.js';
import type { CardActionId } from './types.js';

const TRY_OR_CANCEL_TAGS = [
  'GameplayEvent.Combat.TryPlayCard',
  'GameplayEvent.Combat.CancelPlayCard',
] as const;

function cardListen() {
  return {
    channelTag: 'Combat',
    eventTags: [...TRY_OR_CANCEL_TAGS],
    match: 'any' as const,
  };
}

function damageFaceEffect(cardId: CardActionId, amount: number) {
  return {
    id: `ge.card.${cardId}.damage-face`,
    duration: { kind: 'Instant' as const },
    modifiers: [{ attribute: CombatAttributes.Damage, op: 'Override' as const, magnitude: amount }],
  };
}

function feedDamageToTakeEffect(cardId: CardActionId) {
  return {
    id: `ge.card.${cardId}.feed-damage-to-take`,
    duration: { kind: 'Instant' as const },
    modifiers: [
      {
        attribute: CombatAttributes.DamageToTake,
        op: 'Override' as const,
        magnitude: {
          kind: 'AttributeBased' as const,
          captureFrom: 'Source' as const,
          attribute: CombatAttributes.Damage,
          valueKind: 'Current' as const,
        },
      },
    ],
  };
}

function blockToGainEffect(cardId: CardActionId, amount: number) {
  return {
    id: `ge.card.${cardId}.block-to-gain`,
    duration: { kind: 'Instant' as const },
    modifiers: [{ attribute: CombatAttributes.BlockToGain, op: 'Override' as const, magnitude: amount }],
  };
}

function createVulnerableEffect(
  tagManager: GameplayTagManager,
  combatChannel: GameplayEventChannel,
) {
  return {
    id: 'ge.status.vulnerable',
    duration: {
      kind: 'Duration' as const,
      unitTag: tagManager.resolve('Timing.TurnEnd'),
      magnitude: 1,
      channels: [combatChannel],
    },
    grantedTags: [tagManager.resolve('Status.Vulnerable')],
    stacking: { kind: 'byEffectId' as const, onReapply: 'addDuration' as const },
    modifiers: [
      {
        attribute: CombatAttributes.DamageToTake,
        op: 'Multiply' as const,
        magnitude: 1.25,
        evaluationStage: tagManager.resolve('EvaluationStage.DamageAbsorb'),
      },
    ],
  };
}

function createFlexBuffEffect() {
  return {
    id: 'ge.card.flex.strength',
    duration: { kind: 'Infinite' as const },
    modifiers: [{ attribute: CombatAttributes.Damage, op: 'Add' as const, magnitude: 2 }],
  };
}

function utilityAbility(cardId: CardActionId, name: string) {
  return {
    id: `ga.card.${cardId}`,
    kind: 'active' as const,
    name,
    tags: { abilityTags: [`Card.${cardId}`] },
    chargeCostOnActivate: false,
    endPolicy: 'manual' as const,
    effectsOnActivate: [],
    listenWhileActive: cardListen(),
  };
}

export function createCardDefinitions(
  tagManager: GameplayTagManager,
  combatChannel: GameplayEventChannel,
): Record<CardActionId, CardDefinition> {
  const vulnerable = createVulnerableEffect(tagManager, combatChannel);

  return {
    strike: {
      id: 'strike',
      name: 'Strike',
      cost: 1,
      targeting: 'single_enemy',
      settleTakeDamageOnTarget: true,
      ability: {
        id: 'ga.card.strike',
        kind: 'active',
        name: 'Strike',
        tags: { abilityTags: ['Card.strike'] },
        chargeCostOnActivate: false,
        endPolicy: 'manual',
        effectsOnActivate: [
          { target: 'self', effect: damageFaceEffect('strike', 6) },
          { target: 'target', effect: feedDamageToTakeEffect('strike') },
        ],
        listenWhileActive: cardListen(),
      },
    },
    defend: {
      id: 'defend',
      name: 'Defend',
      cost: 1,
      targeting: 'self',
      applyBlockFromPreview: true,
      ability: {
        id: 'ga.card.defend',
        kind: 'active',
        name: 'Defend',
        tags: { abilityTags: ['Card.defend'] },
        chargeCostOnActivate: false,
        endPolicy: 'manual',
        effectsOnActivate: [{ target: 'self', effect: blockToGainEffect('defend', 5) }],
        listenWhileActive: cardListen(),
      },
    },
    bash: {
      id: 'bash',
      name: 'Bash',
      cost: 2,
      targeting: 'single_enemy',
      settleTakeDamageOnTarget: true,
      ability: {
        id: 'ga.card.bash',
        kind: 'active',
        name: 'Bash',
        tags: { abilityTags: ['Card.bash'] },
        chargeCostOnActivate: false,
        endPolicy: 'manual',
        effectsOnActivate: [
          { target: 'self', effect: damageFaceEffect('bash', 8) },
          { target: 'target', effect: feedDamageToTakeEffect('bash') },
        ],
        listenWhileActive: cardListen(),
      },
    },
    weaken: {
      id: 'weaken',
      name: 'Weaken',
      cost: 1,
      targeting: 'single_enemy',
      commitEffects: [{ target: 'target', effect: vulnerable }],
      ability: utilityAbility('weaken', 'Weaken'),
    },
    flex: {
      id: 'flex',
      name: 'Flex',
      cost: 1,
      targeting: 'self',
      commitEffects: [{ target: 'self', effect: createFlexBuffEffect() }],
      ability: utilityAbility('flex', 'Flex'),
    },
    wait: {
      id: 'wait',
      name: 'Wait',
      cost: 1,
      targeting: 'none',
      ability: utilityAbility('wait', 'Wait'),
    },
  };
}
