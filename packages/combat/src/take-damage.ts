import type { GameplayAbilityDefinition, GameplayTagManager } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import { CombatAttributes } from './combat-attributes.js';
import { settleTakeDamageOnEntity } from './settle-take-damage.js';

/** Settle Block then Health from DamageToTake using Instant GE only. */
export function settleTakeDamage(target: GameplayFrameworkComponent): {
  blocked: number;
  healthLost: number;
} {
  return settleTakeDamageOnEntity(target);
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
  options: {
    health: number;
    block?: number;
    actionPoints?: number;
    takeDamageAbility: GameplayAbilityDefinition;
  },
  tagManager: GameplayTagManager,
): string {
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

  return gfc.grantAbility(options.takeDamageAbility);
}
