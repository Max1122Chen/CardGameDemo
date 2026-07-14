import type { EntityId } from '../engine/component-type.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import { GameplayEffectError } from './errors.js';
import type {
  AttributeValue,
  GameplayEffectApplicationContext,
  GameplayModifierMagnitude,
  GameplayModifierOp,
} from './types.js';

export type ResolvedModifier = {
  op: GameplayModifierOp;
  magnitude: number;
  order: number;
};

export type StagedResolvedModifier = ResolvedModifier & {
  stageIndex: number | undefined;
};

export type AttributeReader = (entityId: EntityId, attribute: string) => AttributeValue | undefined;

export type StageTraceCallback = (stage: string, before: number, after: number) => void;

export function normalizeModifierMagnitude(
  magnitude: number | GameplayModifierMagnitude,
): GameplayModifierMagnitude {
  if (typeof magnitude === 'number') {
    return { kind: 'Scalable', value: magnitude };
  }
  return magnitude;
}

export function resolveModifierMagnitude(
  magnitude: number | GameplayModifierMagnitude,
  ctx: GameplayEffectApplicationContext,
  readAttribute: AttributeReader,
): number {
  const normalized = normalizeModifierMagnitude(magnitude);

  if (normalized.kind === 'Scalable') {
    return normalized.value;
  }

  if (normalized.kind === 'SetByCaller') {
    const value = ctx.setByCaller?.[normalized.key];
    if (value === undefined) {
      throw new GameplayEffectError(
        `SetByCaller magnitude missing key "${normalized.key}" in GameplayEffectApplicationContext.setByCaller`,
      );
    }
    return value;
  }

  const entityId =
    normalized.captureFrom === 'Source' ? ctx.sourceEntityId : ctx.targetEntityId;
  if (!entityId) {
    throw new GameplayEffectError(
      `AttributeBased magnitude requires ${normalized.captureFrom} entity in GameplayEffectApplicationContext`,
    );
  }

  const attributeValue = readAttribute(entityId, normalized.attribute);
  const raw =
    normalized.valueKind === 'Base'
      ? (attributeValue?.baseValue ?? 0)
      : (attributeValue?.currentValue ?? 0);
  const coefficient = normalized.coefficient ?? 1;
  return raw * coefficient;
}

export function modifierRequiresEntity(
  magnitude: number | GameplayModifierMagnitude,
): 'Source' | 'Target' | undefined {
  const normalized = normalizeModifierMagnitude(magnitude);
  if (normalized.kind !== 'AttributeBased') {
    return undefined;
  }
  return normalized.captureFrom;
}

export function evaluateFlatAttributeValue(
  baseValue: number,
  modifiers: readonly ResolvedModifier[],
): number {
  let addSum = 0;
  let multiplyProduct = 1;
  let overrideValue: number | undefined;

  for (const modifier of modifiers) {
    switch (modifier.op) {
      case 'Add':
        addSum += modifier.magnitude;
        break;
      case 'Multiply':
        multiplyProduct *= modifier.magnitude;
        break;
      case 'Override':
        overrideValue = modifier.magnitude;
        break;
      default:
        break;
    }
  }

  if (overrideValue !== undefined) {
    return overrideValue;
  }

  return (baseValue + addSum) * multiplyProduct;
}

export function evaluateStagedAttributeValue(
  baseValue: number,
  stageOrder: readonly GameplayTag[],
  modifiers: readonly StagedResolvedModifier[],
  onStageTrace?: StageTraceCallback,
): number {
  let value = baseValue;
  const staged = new Map<number, StagedResolvedModifier[]>();
  const unstaged: StagedResolvedModifier[] = [];

  for (const modifier of modifiers) {
    if (modifier.stageIndex === undefined) {
      unstaged.push(modifier);
      continue;
    }
    const bucket = staged.get(modifier.stageIndex) ?? [];
    bucket.push(modifier);
    staged.set(modifier.stageIndex, bucket);
  }

  for (let index = 0; index < stageOrder.length; index += 1) {
    const stageModifiers = staged.get(index);
    if (!stageModifiers || stageModifiers.length === 0) {
      continue;
    }

    const before = value;
    value = aggregateStage(value, stageModifiers);
    onStageTrace?.(stageOrder[index]!.name, before, value);
  }

  if (unstaged.length > 0) {
    const before = value;
    value = aggregateStage(value, unstaged);
    onStageTrace?.('final', before, value);
  }

  return value;
}

export function assignModifierStages(
  stageOrder: readonly GameplayTag[],
  evaluationStage: GameplayTag | undefined,
): { stageIndex: number | undefined; unknownStage: boolean } {
  if (!evaluationStage) {
    return { stageIndex: undefined, unknownStage: false };
  }

  const stageIndex = stageOrder.findIndex((stage) => stage.index === evaluationStage.index);
  if (stageIndex < 0) {
    return { stageIndex: undefined, unknownStage: true };
  }

  return { stageIndex, unknownStage: false };
}

function aggregateStage(currentValue: number, modifiers: readonly ResolvedModifier[]): number {
  let addSum = 0;
  let multiplyProduct = 1;
  let overrideValue: number | undefined;

  for (const modifier of modifiers) {
    switch (modifier.op) {
      case 'Add':
        addSum += modifier.magnitude;
        break;
      case 'Multiply':
        multiplyProduct *= modifier.magnitude;
        break;
      case 'Override':
        overrideValue = modifier.magnitude;
        break;
      default:
        break;
    }
  }

  if (overrideValue !== undefined) {
    return overrideValue;
  }

  return (currentValue + addSum) * multiplyProduct;
}
