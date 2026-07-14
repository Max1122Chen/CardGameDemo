import type { GameplayTagManager } from '../tags/gameplay-tag-manager.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';
import type { GameplayAbilityDefinition } from '../ga/types.js';
import type {
  GameplayEffectDefinition,
  GameplayEffectDuration,
  GameplayEffectModifier,
  GameplayModifierMagnitude,
  OngoingTagRequirements,
  GameplayEffectStacking,
} from '../gfc/types.js';
import { GameplayEffectError } from '../gfc/errors.js';
import { createGameplayEventChannel } from '../events/gameplay-event-channel.js';

export type WireGameplayModifierMagnitude =
  | number
  | {
      kind: 'AttributeBased';
      captureFrom: 'Source' | 'Target';
      attribute: string;
      valueKind: 'Base' | 'Current';
      coefficient?: number;
    };

export type WireGameplayEffectModifier = {
  attribute: string;
  op: 'Add' | 'Multiply' | 'Override';
  magnitude: WireGameplayModifierMagnitude;
  evaluationStage?: string;
};

export type WireGameplayEffectDuration =
  | { kind: 'Instant' }
  | { kind: 'Infinite' }
  | {
      kind: 'Duration';
      unitTag: string;
      magnitude: number;
      channels?: string[];
    };

export type WireOngoingTagRequirements = OngoingTagRequirements;

export type WireGameplayEffectStacking = GameplayEffectStacking;

export type WireGameplayEffectDefinition = {
  id: string;
  modifiers: WireGameplayEffectModifier[];
  duration: WireGameplayEffectDuration;
  grantedTags?: string[];
  ongoingTagRequirements?: WireOngoingTagRequirements;
  stacking?: WireGameplayEffectStacking;
};

export type WireGameplayAbilityDefinition = GameplayAbilityDefinition;

export class DefinitionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DefinitionParseError';
  }
}

function resolveTagName(manager: GameplayTagManager, name: string, path: string): GameplayTag {
  try {
    return manager.resolve(name);
  } catch {
    throw new DefinitionParseError(`Unknown tag at ${path}: ${name}`);
  }
}

function parseMagnitude(
  magnitude: WireGameplayModifierMagnitude,
  path: string,
): number | GameplayModifierMagnitude {
  if (typeof magnitude === 'number') {
    return magnitude;
  }
  if (magnitude.kind !== 'AttributeBased') {
    throw new DefinitionParseError(`Unsupported magnitude kind at ${path}`);
  }
  return magnitude;
}

function parseModifier(
  manager: GameplayTagManager,
  modifier: WireGameplayEffectModifier,
  index: number,
): GameplayEffectModifier {
  const path = `modifiers[${index}]`;
  return {
    attribute: modifier.attribute,
    op: modifier.op,
    magnitude: parseMagnitude(modifier.magnitude, `${path}.magnitude`),
    evaluationStage: modifier.evaluationStage
      ? resolveTagName(manager, modifier.evaluationStage, `${path}.evaluationStage`)
      : undefined,
  };
}

function parseDuration(
  manager: GameplayTagManager,
  duration: WireGameplayEffectDuration,
): GameplayEffectDuration {
  if (duration.kind === 'Instant' || duration.kind === 'Infinite') {
    return duration;
  }

  return {
    kind: 'Duration',
    unitTag: resolveTagName(manager, duration.unitTag, 'duration.unitTag'),
    magnitude: duration.magnitude,
    channels: duration.channels?.map((channelTag, index) =>
      createGameplayEventChannel(
        resolveTagName(manager, channelTag, `duration.channels[${index}]`),
      ),
    ),
  };
}

export function parseGameplayEffectDefinition(
  wire: WireGameplayEffectDefinition,
  manager: GameplayTagManager,
): GameplayEffectDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('GameplayEffectDefinition.id is required');
  }

  try {
    return {
      id: wire.id,
      modifiers: wire.modifiers.map((modifier, index) => parseModifier(manager, modifier, index)),
      duration: parseDuration(manager, wire.duration),
      grantedTags: wire.grantedTags?.map((tag, index) =>
        resolveTagName(manager, tag, `grantedTags[${index}]`),
      ),
      ongoingTagRequirements: wire.ongoingTagRequirements,
      stacking: wire.stacking,
    };
  } catch (error) {
    if (error instanceof DefinitionParseError || error instanceof GameplayEffectError) {
      throw error;
    }
    throw new DefinitionParseError(
      `Failed to parse GameplayEffectDefinition ${wire.id}: ${String(error)}`,
    );
  }
}

export function parseGameplayAbilityDefinition(
  wire: WireGameplayAbilityDefinition,
): GameplayAbilityDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('GameplayAbilityDefinition.id is required');
  }
  return { ...wire };
}
