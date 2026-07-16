import type { GameplayFrameworkComponent, GameplayTagManager } from '@cardgame/core';
import type { GameplayEffectApplicationContext } from '@cardgame/core';
import type { AttributeBonusConfig, AttributeBonusSpec } from './attribute-bonus.js';
import { computeAttributeBonusForEntity } from './attribute-bonus.js';
import { CombatAttributes } from './combat-attributes.js';
import type { DealDamageResult } from './deal-damage.js';
import { SetByCallerKeys } from './set-by-caller-keys.js';

/** Run source Damage pipeline then feed DamageToTake and activate TakeDamage on target. */
export function dealOutgoingDamage(args: {
  source: GameplayFrameworkComponent;
  target: GameplayFrameworkComponent;
  panelDamage: number;
  tagManager: GameplayTagManager;
  attributeBonus?: AttributeBonusSpec;
  bonusConfig?: AttributeBonusConfig;
  instigatorEntityId: string;
  activateTakeDamage: (
    entityId: string,
    ctx: GameplayEffectApplicationContext,
  ) => { blocked: number; healthLost: number };
}): DealDamageResult {
  const {
    source,
    target,
    panelDamage,
    tagManager,
    attributeBonus,
    bonusConfig,
    instigatorEntityId,
    activateTakeDamage,
  } = args;

  const bonus = attributeBonus
    ? computeAttributeBonusForEntity(attributeBonus, source, bonusConfig)
    : 0;

  const commonStage = tagManager.resolve('EvaluationStage.CommonDamage');
  const applyCtx = {
    instigatorEntityId,
    sourceEntityId: source.entityId,
  };

  source.applyGameplayEffect(
    {
      id: 'ge.template.damage-face',
      duration: { kind: 'Instant' },
      modifiers: [
        {
          attribute: CombatAttributes.Damage,
          op: 'Override',
          magnitude: { kind: 'SetByCaller', key: SetByCallerKeys.Damage },
        },
        {
          attribute: CombatAttributes.Damage,
          op: 'Add',
          magnitude: { kind: 'SetByCaller', key: SetByCallerKeys.AttributeBonus },
          evaluationStage: commonStage,
        },
      ],
    },
    {
      ...applyCtx,
      setByCaller: {
        [SetByCallerKeys.Damage]: panelDamage,
        [SetByCallerKeys.AttributeBonus]: bonus,
      },
    },
  );

  target.applyGameplayEffect(
    {
      id: 'ge.template.feed-damage-to-take',
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
    },
    applyCtx,
  );

  const amount = target.getAttribute(CombatAttributes.DamageToTake)?.currentValue ?? 0;
  const result = activateTakeDamage(target.entityId, {
    instigatorEntityId,
    sourceEntityId: source.entityId,
    targetEntityId: target.entityId,
  });

  return { amount, blocked: result.blocked, healthLost: result.healthLost };
}
