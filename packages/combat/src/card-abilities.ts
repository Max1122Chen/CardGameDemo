import type { GameplayEffectDefinition } from '@cardgame/core';
import { CombatAttributes } from './combat-attributes.js';

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
