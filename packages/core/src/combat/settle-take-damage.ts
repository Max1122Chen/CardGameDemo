import type {
  GameplayEffectApplicationContext,
  GameplayEffectDefinition,
} from '../gfc/types.js';

export type TakeDamageEntity = {
  getAttribute(attribute: string): { currentValue: number } | undefined;
  applyGameplayEffect(
    effect: GameplayEffectDefinition,
    context?: GameplayEffectApplicationContext,
  ): string;
};

/** Settle Block then Health from DamageToTake using Instant GE only. */
export function settleTakeDamageOnEntity(target: TakeDamageEntity): {
  blocked: number;
  healthLost: number;
} {
  const take = target.getAttribute('DamageToTake')?.currentValue ?? 0;
  const block = target.getAttribute('Block')?.currentValue ?? 0;
  const health = target.getAttribute('Health')?.currentValue ?? 0;

  if (take <= 0) {
    return { blocked: 0, healthLost: 0 };
  }

  if (block >= take) {
    target.applyGameplayEffect({
      id: 'ge.combat.take.block-only',
      duration: { kind: 'Instant' },
      modifiers: [{ attribute: 'Block', op: 'Add', magnitude: -take }],
    });
    return { blocked: take, healthLost: 0 };
  }

  const healthLost = Math.floor(take - block);
  target.applyGameplayEffect({
    id: 'ge.combat.take.overflow',
    duration: { kind: 'Instant' },
    modifiers: [
      { attribute: 'Block', op: 'Override', magnitude: 0 },
      {
        attribute: 'Health',
        op: 'Override',
        magnitude: Math.max(0, health - healthLost),
      },
    ],
  });
  return { blocked: block, healthLost };
}
