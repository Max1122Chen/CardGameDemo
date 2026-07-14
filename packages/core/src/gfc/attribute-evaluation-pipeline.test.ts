import { describe, expect, it } from 'vitest';

import { RuleEngine } from '../engine/rule-engine.js';
import { TraceBuffer } from '../trace/trace.js';
import { GameplayEffectError } from './errors.js';
import type { GameplayEffectApplicationContext, GameplayEffectDefinition } from './types.js';

function createEffect(effect: GameplayEffectDefinition): GameplayEffectDefinition {
  return effect;
}

function geCtx(
  engine: RuleEngine,
  overrides: Partial<GameplayEffectApplicationContext> & { instigatorEntityId: string },
): GameplayEffectApplicationContext {
  return {
    instigatorEntityId: overrides.instigatorEntityId,
    sourceEntityId: overrides.sourceEntityId,
    targetEntityId: overrides.targetEntityId,
    payload: overrides.payload,
  };
}

describe('CORE-F09 attribute evaluation pipeline', () => {
  it('probe 1: no pipeline keeps CORE-F06 flat aggregation', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    gfc.setAttributeBase('Strength', 10);

    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.flat',
        duration: { kind: 'Infinite' },
        modifiers: [
          { attribute: 'Strength', op: 'Add', magnitude: 2 },
          { attribute: 'Strength', op: 'Multiply', magnitude: 1.5 },
        ],
      }),
    );

    expect(gfc.getAttribute('Strength')).toEqual({
      baseValue: 10,
      currentValue: 18,
    });
  });

  it('probe 2: staged pipeline applies stages sequentially', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');
    const offset = engine.tagManager.resolve('EvaluationStage.DamageOffset');

    gfc.setAttributeBase('Damage', 10);
    gfc.bindEvaluationPipeline({
      attribute: 'Damage',
      stageOrder: [common, offset],
    });
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.stage.common',
        duration: { kind: 'Infinite' },
        modifiers: [
          { attribute: 'Damage', op: 'Add', magnitude: 5, evaluationStage: common },
          { attribute: 'Damage', op: 'Multiply', magnitude: 2, evaluationStage: common },
        ],
      }),
    );
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.stage.offset',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Damage', op: 'Add', magnitude: 3, evaluationStage: offset }],
      }),
    );

    expect(gfc.getAttribute('Damage')?.currentValue).toBe(33);
  });

  it('probe 3: multiply modifiers in one stage use product', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');

    gfc.setAttributeBase('Damage', 10);
    gfc.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [common] });
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.mul.product',
        duration: { kind: 'Infinite' },
        modifiers: [
          { attribute: 'Damage', op: 'Multiply', magnitude: 1.5, evaluationStage: common },
          { attribute: 'Damage', op: 'Multiply', magnitude: 2, evaluationStage: common },
        ],
      }),
    );

    expect(gfc.getAttribute('Damage')?.currentValue).toBe(30);
  });

  it('probe 4: unstaged modifiers run in final batch after ordered stages', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');

    gfc.setAttributeBase('Damage', 10);
    gfc.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [common] });
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.staged',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Damage', op: 'Multiply', magnitude: 2, evaluationStage: common }],
      }),
    );
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.unstaged',
        duration: { kind: 'Infinite' },
        modifiers: [{ attribute: 'Damage', op: 'Add', magnitude: 5 }],
      }),
    );

    expect(gfc.getAttribute('Damage')?.currentValue).toBe(25);
  });

  it('probe 5: attribute based instant captures once at apply', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('Constitution', 8);

    player.applyGameplayEffect(
      createEffect({
        id: 'ge.instant.health',
        duration: { kind: 'Instant' },
        modifiers: [
          {
            attribute: 'Health',
            op: 'Add',
            magnitude: {
              kind: 'AttributeBased',
              captureFrom: 'Source',
              attribute: 'Constitution',
              valueKind: 'Current',
              coefficient: 2,
            },
          },
        ],
      }),
      geCtx(engine, { instigatorEntityId: 'player', sourceEntityId: 'player' }),
    );

    expect(player.getAttribute('Health')).toEqual({ baseValue: 16, currentValue: 16 });
    player.setAttributeBase('Constitution', 20);
    expect(player.getAttribute('Health')).toEqual({ baseValue: 16, currentValue: 16 });
  });

  it('probe 6: attribute based infinite re-captures on recompute', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    player.setAttributeBase('Constitution', 5);

    player.applyGameplayEffect(
      createEffect({
        id: 'ge.infinite.health',
        duration: { kind: 'Infinite' },
        modifiers: [
          {
            attribute: 'Health',
            op: 'Add',
            magnitude: {
              kind: 'AttributeBased',
              captureFrom: 'Source',
              attribute: 'Constitution',
              valueKind: 'Current',
              coefficient: 2,
            },
          },
        ],
      }),
      geCtx(engine, { instigatorEntityId: 'player', sourceEntityId: 'player' }),
    );

    expect(player.getAttribute('Health')?.currentValue).toBe(10);
    player.setAttributeBase('Constitution', 8);
    expect(player.getAttribute('Health')?.currentValue).toBe(16);
  });

  it('probe 7: missing source entity throws GameplayEffectError', () => {
    const engine = RuleEngine.create();
    const gfc = engine.createEntityWithGfc('player');

    expect(() =>
      gfc.applyGameplayEffect(
        createEffect({
          id: 'ge.bad.ctx',
          duration: { kind: 'Infinite' },
          modifiers: [
            {
              attribute: 'Health',
              op: 'Add',
              magnitude: {
                kind: 'AttributeBased',
                captureFrom: 'Source',
                attribute: 'Constitution',
                valueKind: 'Current',
              },
            },
          ],
        }),
      ),
    ).toThrow(GameplayEffectError);
  });

  it('probe 8: unknown stage falls back to unstaged with warning trace', () => {
    const trace = new TraceBuffer();
    const engine = RuleEngine.create({ traceSink: trace });
    const gfc = engine.createEntityWithGfc('player');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');
    const unknown = engine.tagManager.resolve('EvaluationStage.DamageOffset');

    gfc.setAttributeBase('Damage', 10);
    gfc.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [common] });
    gfc.applyGameplayEffect(
      createEffect({
        id: 'ge.unknown.stage',
        duration: { kind: 'Infinite' },
        modifiers: [
          { attribute: 'Damage', op: 'Multiply', magnitude: 2, evaluationStage: common },
          { attribute: 'Damage', op: 'Add', magnitude: 7, evaluationStage: unknown },
        ],
      }),
    );

    expect(gfc.getAttribute('Damage')?.currentValue).toBe(27);
    expect(trace.entries.some((entry) => entry.kind === 'ge.modifier.stage.fallback')).toBe(true);
  });

  it('probe 9: per-entity pipelines differ for same attribute name', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const enemy = engine.createEntityWithGfc('enemy');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');
    const offset = engine.tagManager.resolve('EvaluationStage.DamageOffset');

    player.setAttributeBase('Damage', 10);
    enemy.setAttributeBase('Damage', 10);
    player.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [common, offset] });
    enemy.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [offset, common] });

    const effect = createEffect({
      id: 'ge.shared',
      duration: { kind: 'Infinite' },
      modifiers: [
        { attribute: 'Damage', op: 'Add', magnitude: 5, evaluationStage: common },
        { attribute: 'Damage', op: 'Multiply', magnitude: 2, evaluationStage: offset },
      ],
    });

    player.applyGameplayEffect(effect);
    enemy.applyGameplayEffect(effect);

    expect(player.getAttribute('Damage')?.currentValue).toBe(30);
    expect(enemy.getAttribute('Damage')?.currentValue).toBe(25);
  });

  it('probe 10: damage pipeline fixture matches design doc flow', () => {
    const engine = RuleEngine.create();
    const attacker = engine.createEntityWithGfc('attacker');
    const common = engine.tagManager.resolve('EvaluationStage.CommonDamage');
    const offset = engine.tagManager.resolve('EvaluationStage.DamageOffset');

    attacker.setAttributeBase('Damage', 10);
    attacker.setAttributeBase('DamageMultiplier', 1.5);
    attacker.setAttributeBase('DamageCorrection', 2);
    attacker.setAttributeBase('DamageOffset', 3);
    attacker.bindEvaluationPipeline({ attribute: 'Damage', stageOrder: [common, offset] });

    attacker.applyGameplayEffect(
      createEffect({
        id: 'ge.damage.common',
        duration: { kind: 'Infinite' },
        modifiers: [
          {
            attribute: 'Damage',
            op: 'Multiply',
            magnitude: {
              kind: 'AttributeBased',
              captureFrom: 'Source',
              attribute: 'DamageMultiplier',
              valueKind: 'Current',
            },
            evaluationStage: common,
          },
          {
            attribute: 'Damage',
            op: 'Multiply',
            magnitude: {
              kind: 'AttributeBased',
              captureFrom: 'Source',
              attribute: 'DamageCorrection',
              valueKind: 'Current',
            },
            evaluationStage: common,
          },
          {
            attribute: 'Damage',
            op: 'Add',
            magnitude: {
              kind: 'AttributeBased',
              captureFrom: 'Source',
              attribute: 'DamageOffset',
              valueKind: 'Current',
            },
            evaluationStage: offset,
          },
        ],
      }),
      geCtx(engine, { instigatorEntityId: 'attacker', sourceEntityId: 'attacker' }),
    );

    expect(attacker.getAttribute('Damage')?.currentValue).toBe(33);
  });

  it('probe 11: GA tryActivate forwards GE application context', () => {
    const engine = RuleEngine.create();
    const player = engine.createEntityWithGfc('player');
    const enemy = engine.createEntityWithGfc('enemy');
    player.setAttributeBase('Constitution', 4);

    const handle = player.grantAbility({
      id: 'ability.buff.health',
      kind: 'active',
      tags: {},
      effectsOnActivate: [
        {
          target: 'self',
          effect: {
            id: 'ge.ga.health',
            duration: { kind: 'Infinite' },
            modifiers: [
              {
                attribute: 'Health',
                op: 'Add',
                magnitude: {
                  kind: 'AttributeBased',
                  captureFrom: 'Source',
                  attribute: 'Constitution',
                  valueKind: 'Current',
                },
              },
            ],
          },
        },
      ],
    });

    const result = player.tryActivate(handle, {
      instigatorEntityId: 'player',
      sourceEntityId: 'player',
      targetEntityId: 'enemy',
    });

    expect(result.ok).toBe(true);
    expect(player.getAttribute('Health')?.currentValue).toBe(4);
  });
});
