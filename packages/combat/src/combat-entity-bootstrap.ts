import type { GameplayAbilityDefinition, GameplayTagManager } from '@cardgame/core';
import type { GameplayFrameworkComponent } from '@cardgame/core';
import {
  CombatAttributes,
  DEFAULT_ENEMY_PRIMARIES,
  DEFAULT_PLAYER_PRIMARIES,
  PrimaryAttributes,
  type PrimaryAttributeBlock,
} from './combat-attributes.js';

export type CombatEntityBootstrapOptions = {
  maxHealth: number;
  block?: number;
  maxActionPoints?: number;
  actionPoints?: number;
  primaries?: Partial<PrimaryAttributeBlock>;
  takeDamageAbility: GameplayAbilityDefinition;
};

export function registerCombatAttributeClamps(gfc: GameplayFrameworkComponent): void {
  gfc.onPreAttributeChange((ctx) => {
    if (ctx.attribute === CombatAttributes.Health) {
      const max = gfc.getAttribute(CombatAttributes.MaxHealth)?.currentValue;
      ctx.newValue =
        max !== undefined
          ? Math.min(Math.max(0, ctx.newValue), max)
          : Math.max(0, ctx.newValue);
      return;
    }
    if (ctx.attribute === CombatAttributes.ActionPoints) {
      const max = gfc.getAttribute(CombatAttributes.MaxActionPoints)?.currentValue;
      ctx.newValue =
        max !== undefined
          ? Math.min(Math.max(0, ctx.newValue), max)
          : Math.max(0, ctx.newValue);
    }
  });
}

function applyPrimaryAttributes(
  gfc: GameplayFrameworkComponent,
  primaries: Partial<PrimaryAttributeBlock>,
): void {
  for (const key of PrimaryAttributes) {
    const value = primaries[key];
    if (value !== undefined) {
      gfc.setAttributeBase(key, value);
    }
  }
}

export function bootstrapCombatEntity(
  gfc: GameplayFrameworkComponent,
  options: CombatEntityBootstrapOptions,
  tagManager: GameplayTagManager,
): string {
  registerCombatAttributeClamps(gfc);

  gfc.setAttributeBase(CombatAttributes.MaxHealth, options.maxHealth);
  gfc.setAttributeBase(CombatAttributes.Health, options.maxHealth);
  gfc.setAttributeBase(CombatAttributes.Block, options.block ?? 0);

  if (options.maxActionPoints !== undefined) {
    gfc.setAttributeBase(CombatAttributes.MaxActionPoints, options.maxActionPoints);
    gfc.setAttributeBase(
      CombatAttributes.ActionPoints,
      options.actionPoints ?? options.maxActionPoints,
    );
  }

  applyPrimaryAttributes(gfc, options.primaries ?? {});

  gfc.setAttributeBase(CombatAttributes.Damage, 0);
  gfc.setAttributeBase(CombatAttributes.DamageScaling, 1);
  gfc.setAttributeBase(CombatAttributes.DamageMultiplier, 1);
  gfc.setAttributeBase(CombatAttributes.DamageOffset, 0);
  gfc.setAttributeBase(CombatAttributes.DamageToTake, 0);
  gfc.setAttributeBase(CombatAttributes.BlockToGain, 0);

  const commonStage = tagManager.resolve('EvaluationStage.CommonDamage');
  const offsetStage = tagManager.resolve('EvaluationStage.DamageOffset');
  const absorbStage = tagManager.resolve('EvaluationStage.DamageAbsorb');

  gfc.bindEvaluationPipeline({
    attribute: CombatAttributes.Damage,
    stageOrder: [commonStage, offsetStage],
  });

  gfc.bindEvaluationPipeline({
    attribute: CombatAttributes.DamageToTake,
    stageOrder: [absorbStage],
  });

  gfc.applyGameplayEffect(
    {
      id: 'ge.combat.damage.pipeline',
      duration: { kind: 'Infinite' },
      modifiers: [
      {
        attribute: CombatAttributes.Damage,
        op: 'Multiply',
        magnitude: {
          kind: 'AttributeBased',
          captureFrom: 'Source',
          attribute: CombatAttributes.DamageScaling,
          valueKind: 'Current',
        },
        evaluationStage: commonStage,
      },
      {
        attribute: CombatAttributes.Damage,
        op: 'Multiply',
        magnitude: {
          kind: 'AttributeBased',
          captureFrom: 'Source',
          attribute: CombatAttributes.DamageMultiplier,
          valueKind: 'Current',
        },
        evaluationStage: commonStage,
      },
      {
        attribute: CombatAttributes.Damage,
        op: 'Add',
        magnitude: {
          kind: 'AttributeBased',
          captureFrom: 'Source',
          attribute: CombatAttributes.DamageOffset,
          valueKind: 'Current',
        },
        evaluationStage: offsetStage,
      },
    ],
  },
  {
    instigatorEntityId: gfc.entityId,
    sourceEntityId: gfc.entityId,
    targetEntityId: gfc.entityId,
  });

  gfc.applyGameplayEffect(
    {
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
  },
  {
    instigatorEntityId: gfc.entityId,
    sourceEntityId: gfc.entityId,
    targetEntityId: gfc.entityId,
  });

  return gfc.grantAbility(options.takeDamageAbility);
}

/** Reset transient combat pipeline attributes between plays / turns. */
export function resetCombatMeta(entity: GameplayFrameworkComponent): void {
  entity.applyGameplayEffect({
    id: 'ge.combat.meta.reset',
    duration: { kind: 'Instant' },
    modifiers: [
      { attribute: CombatAttributes.Damage, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.DamageToTake, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.BlockToGain, op: 'Override', magnitude: 0 },
      { attribute: CombatAttributes.DamageScaling, op: 'Override', magnitude: 1 },
      { attribute: CombatAttributes.DamageMultiplier, op: 'Override', magnitude: 1 },
      { attribute: CombatAttributes.DamageOffset, op: 'Override', magnitude: 0 },
    ],
  });
}

/** Convenience wrapper: health arg maps to maxHealth for bootstrapCombatEntity. */
export function bootstrapCombatAttributes(
  gfc: GameplayFrameworkComponent,
  options: {
    health: number;
    block?: number;
    actionPoints?: number;
    maxActionPoints?: number;
    primaries?: CombatEntityBootstrapOptions['primaries'];
    takeDamageAbility: GameplayAbilityDefinition;
  },
  tagManager: GameplayTagManager,
): string {
  const maxAp = options.maxActionPoints ?? options.actionPoints;
  return bootstrapCombatEntity(
    gfc,
    {
      maxHealth: options.health,
      block: options.block,
      maxActionPoints: maxAp,
      actionPoints: options.actionPoints ?? maxAp,
      primaries: options.primaries,
      takeDamageAbility: options.takeDamageAbility,
    },
    tagManager,
  );
}

export { DEFAULT_PLAYER_PRIMARIES, DEFAULT_ENEMY_PRIMARIES };
