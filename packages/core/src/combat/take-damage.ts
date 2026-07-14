import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayFrameworkComponent } from '../gfc/gameplay-framework-component.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import { CombatAttributes } from './combat-attributes.js';

/** Settle Block then Health from DamageToTake using Instant GE only. */
export function settleTakeDamage(target: GameplayFrameworkComponent): {
  blocked: number;
  healthLost: number;
} {
  const take = target.getAttribute(CombatAttributes.DamageToTake)?.currentValue ?? 0;
  const block = target.getAttribute(CombatAttributes.Block)?.currentValue ?? 0;
  const health = target.getAttribute(CombatAttributes.Health)?.currentValue ?? 0;

  if (take <= 0) {
    return { blocked: 0, healthLost: 0 };
  }

  if (block >= take) {
    target.applyGameplayEffect({
      id: 'ge.combat.take.block-only',
      duration: { kind: 'Instant' },
      modifiers: [{ attribute: CombatAttributes.Block, op: 'Add', magnitude: -take }],
    });
    return { blocked: take, healthLost: 0 };
  }

  const healthLost = take - block;
  const effects: GameplayEffectDefinition = {
    id: 'ge.combat.take.overflow',
    duration: { kind: 'Instant' },
    modifiers: [
      { attribute: CombatAttributes.Block, op: 'Override', magnitude: 0 },
      {
        attribute: CombatAttributes.Health,
        op: 'Override',
        magnitude: Math.max(0, health - healthLost),
      },
    ],
  };
  target.applyGameplayEffect(effects);
  return { blocked: block, healthLost };
}

export function resetCombatMeta(entity: GameplayFrameworkComponent): void {
  entity.applyGameplayEffect({
    id: 'ge.combat.meta.reset',
    duration: { kind: 'Instant' },
    modifiers: [
      { attribute: CombatAttributes.Damage, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.DamageToTake, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.BlockToGain, op: 'Override', magnitude: 0 },
    ],
  });
}

export function bootstrapCombatAttributes(
  gfc: GameplayFrameworkComponent,
  options: { health: number; block?: number; actionPoints?: number },
  tagManager: GameplayTagManager,
): void {
  gfc.setAttributeBase(CombatAttributes.Health, options.health);
  gfc.setAttributeBase(CombatAttributes.Block, options.block ?? 0);
  if (options.actionPoints !== undefined) {
    gfc.setAttributeBase(CombatAttributes.ActionPoints, options.actionPoints);
  }
  gfc.setAttributeBase(CombatAttributes.Damage, 0);
  gfc.setAttributeBase(CombatAttributes.DamageToTake, 0);
  gfc.setAttributeBase(CombatAttributes.BlockToGain, 0);

  const absorbStage = tagManager.resolve('EvaluationStage.DamageAbsorb');
  gfc.bindEvaluationPipeline({
    attribute: CombatAttributes.DamageToTake,
    stageOrder: [absorbStage],
  });

  // Identity absorption GE — pipeline stays ready for later absorb multipliers.
  gfc.applyGameplayEffect({
    id: 'ge.combat.damage-to-take.identity',
    duration: { kind: 'Infinite' },
    modifiers: [
      {
        attribute: CombatAttributes.DamageToTake,
        op: 'Multiply',
        magnitude: 1,
        evaluationStage: absorbStage,
      },
    ],
  });
}
