import { describe, expect, it } from 'vitest';

import { createGameplayEvent } from '../events/gameplay-event.js';
import { createGameplayEventChannel } from '../events/gameplay-event-channel.js';
import { emitTurnEndTimingEvent } from '../events/timing-events.js';
import { RuleEngine } from '../engine/rule-engine.js';
import { parseGameplayEffectDefinition } from '../definitions/parse-definitions.js';
import { createTakeDamageAbilityDefinition } from '../combat/take-damage-ability.js';
import { CombatAttributes } from '../combat/combat-attributes.js';
import { bootstrapCombatAttributes } from '../combat/take-damage.js';

describe('CORE-F10 — GFC gaps', () => {
  it('ongoing source/target gates disable modifiers until tag present', () => {
    const engine = RuleEngine.create();
    const source = engine.createEntityWithGfc('source');
    const target = engine.createEntityWithGfc('target');
    const vulnerable = engine.tagManager.resolve('Status.Vulnerable');
    const absorbStage = engine.tagManager.resolve('EvaluationStage.DamageAbsorb');

    for (const gfc of [source, target]) {
      gfc.setAttributeBase(CombatAttributes.DamageToTake, 0);
      gfc.bindEvaluationPipeline({
        attribute: CombatAttributes.DamageToTake,
        stageOrder: [absorbStage],
      });
    }

    target.applyGameplayEffect(
      {
        id: 'ge.absorb.vulnerable-only',
        duration: { kind: 'Infinite' },
        ongoingTagRequirements: { targetRequiredTags: ['Status.Vulnerable'] },
        modifiers: [
          {
            attribute: CombatAttributes.DamageToTake,
            op: 'Multiply',
            magnitude: 1.25,
            evaluationStage: absorbStage,
          },
        ],
      },
      {
        instigatorEntityId: 'source',
        sourceEntityId: 'source',
        targetEntityId: 'target',
      },
    );

    target.setAttributeBase(CombatAttributes.DamageToTake, 8);
    expect(target.getAttribute(CombatAttributes.DamageToTake)?.currentValue).toBe(8);

    target.addTag(vulnerable);
    expect(target.getAttribute(CombatAttributes.DamageToTake)?.currentValue).toBe(10);
  });

  it('stacking addDuration merges duration magnitude by effect id', () => {
    const engine = RuleEngine.create();
    const target = engine.createEntityWithGfc('target');
    const combat = engine.eventSystem.channel(engine.tagManager.resolve('Combat'));
    const turnEnd = engine.tagManager.resolve('Timing.TurnEnd');

    const vulnerableDef = {
      id: 'ge.status.vulnerable',
      duration: {
        kind: 'Duration' as const,
        unitTag: turnEnd,
        magnitude: 1,
        channels: [combat],
      },
      grantedTags: [engine.tagManager.resolve('Status.Vulnerable')],
      stacking: { kind: 'byEffectId' as const, onReapply: 'addDuration' as const },
      modifiers: [] as const,
    };

    const ctx = {
      instigatorEntityId: 'source',
      sourceEntityId: 'source',
      targetEntityId: 'target',
    };

    target.applyGameplayEffect(vulnerableDef, ctx);
    target.applyGameplayEffect(vulnerableDef, ctx);

    const active = target.listActiveEffects();
    expect(active).toHaveLength(1);
    expect(active[0]?.stackedDurationMagnitude).toBe(2);

    emitTurnEndTimingEvent(engine, combat, { entityId: 'target' });
    expect(target.listActiveEffects()).toHaveLength(1);
    expect(target.listActiveEffects()[0]?.durationProgress).toBe(1);

    emitTurnEndTimingEvent(engine, combat, { entityId: 'target' });
    expect(target.listActiveEffects()).toHaveLength(0);
  });

  it('parseGameplayEffectDefinition resolves tag names', () => {
    const engine = RuleEngine.create();
    const parsed = parseGameplayEffectDefinition(
      {
        id: 'ge.test',
        duration: { kind: 'Duration', unitTag: 'Timing.TurnEnd', magnitude: 1 },
        grantedTags: ['Status.Vulnerable'],
        modifiers: [
          {
            attribute: 'DamageToTake',
            op: 'Multiply',
            magnitude: 1.25,
            evaluationStage: 'EvaluationStage.DamageAbsorb',
          },
        ],
      },
      engine.tagManager,
    );

    expect(parsed.grantedTags?.[0]?.name).toBe('Status.Vulnerable');
    expect(parsed.modifiers[0]?.evaluationStage?.name).toBe('EvaluationStage.DamageAbsorb');
  });

  it('TakeDamage GA settles Block then Health', () => {
    const engine = RuleEngine.create();
    const target = engine.createEntityWithGfc('target');
    bootstrapCombatAttributes(target, { health: 20, block: 3 }, engine.tagManager);
    const handle = target.listGrantedAbilities().find((a) => a.abilityDefId === 'ga.combat.take-damage')?.handle;
    expect(handle).toBeDefined();

    target.setAttributeBase(CombatAttributes.DamageToTake, 8);

    const result = target.tryActivate(handle!, {
      instigatorEntityId: 'source',
      sourceEntityId: 'source',
      targetEntityId: 'target',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.activationData?.takeDamage).toEqual({ blocked: 3, healthLost: 5 });
    }
    expect(target.getAttribute(CombatAttributes.Health)?.currentValue).toBe(15);
    expect(target.getAttribute(CombatAttributes.Block)?.currentValue).toBe(0);
  });
});

describe('createTakeDamageAbilityDefinition', () => {
  it('marks builtin activation', () => {
    expect(createTakeDamageAbilityDefinition().builtinActivation).toBe('combat.takeDamage');
  });
});
