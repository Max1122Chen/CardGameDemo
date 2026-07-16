import type { GameplayFrameworkComponent } from '@cardgame/core';
import type { GameplayEffectApplicationContext } from '@cardgame/core';
import { CombatAttributes } from './combat-attributes.js';
import { CombatError } from './errors.js';

export type DealDamageResult = {
  amount: number;
  blocked: number;
  healthLost: number;
};

/**
 * Feed DamageToTake then activate TakeDamage on the target.
 * Shared by card commit and enemy attack (CORE-F12 D8).
 */
export function dealDamageToEntity(args: {
  target: GameplayFrameworkComponent;
  amount: number;
  instigatorEntityId: string;
  sourceEntityId: string;
  activateTakeDamage: (
    entityId: string,
    ctx: GameplayEffectApplicationContext,
  ) => { blocked: number; healthLost: number };
}): DealDamageResult {
  const { target, amount, instigatorEntityId, sourceEntityId, activateTakeDamage } = args;
  if (amount < 0) {
    throw new CombatError(`dealDamageToEntity: amount must be >= 0, got ${amount}`);
  }

  target.applyGameplayEffect(
    {
      id: 'ge.combat.feed-damage-to-take',
      duration: { kind: 'Instant' },
      modifiers: [
        { attribute: CombatAttributes.DamageToTake, op: 'Override', magnitude: amount },
      ],
    },
    { instigatorEntityId, sourceEntityId },
  );

  const result = activateTakeDamage(target.entityId, {
    instigatorEntityId,
    sourceEntityId,
    targetEntityId: target.entityId,
  });

  return { amount, blocked: result.blocked, healthLost: result.healthLost };
}
