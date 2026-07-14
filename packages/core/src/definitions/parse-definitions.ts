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
    }
  | {
      kind: 'SetByCaller';
      key: string;
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

export type WireGameplayAbilityEffectBinding = {
  target: 'self' | 'target';
  effect: WireGameplayEffectDefinition;
};

export type WireGameplayAbilityDefinition = {
  id: string;
  kind: 'active' | 'passive';
  name?: string;
  tags: GameplayAbilityDefinition['tags'];
  cost?: GameplayAbilityDefinition['cost'];
  chargeCostOnActivate?: boolean;
  endPolicy?: GameplayAbilityDefinition['endPolicy'];
  effectsOnActivate: readonly WireGameplayAbilityEffectBinding[];
  listenWhileActive?: GameplayAbilityDefinition['listenWhileActive'];
  handlerId?: string;
  autoActivateOnGrant?: boolean;
  passiveTrigger?: GameplayAbilityDefinition['passiveTrigger'];
};

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
  if (magnitude.kind === 'AttributeBased' || magnitude.kind === 'SetByCaller') {
    return magnitude;
  }
  throw new DefinitionParseError(`Unsupported magnitude kind at ${path}`);
}

function parseModifier(
  manager: GameplayTagManager,
  modifier: WireGameplayEffectModifier,
  index: number,
  pathPrefix = 'modifiers',
): GameplayEffectModifier {
  const path = `${pathPrefix}[${index}]`;
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
  pathPrefix = 'duration',
): GameplayEffectDuration {
  if (duration.kind === 'Instant' || duration.kind === 'Infinite') {
    return duration;
  }

  return {
    kind: 'Duration',
    unitTag: resolveTagName(manager, duration.unitTag, `${pathPrefix}.unitTag`),
    magnitude: duration.magnitude,
    channels: duration.channels?.map((channelTag, index) =>
      createGameplayEventChannel(
        resolveTagName(manager, channelTag, `${pathPrefix}.channels[${index}]`),
      ),
    ),
  };
}

export function parseGameplayEffectDefinition(
  wire: WireGameplayEffectDefinition,
  manager: GameplayTagManager,
  pathPrefix = 'effect',
): GameplayEffectDefinition {
  if (!wire.id) {
    throw new DefinitionParseError(`${pathPrefix}: GameplayEffectDefinition.id is required`);
  }

  try {
    return {
      id: wire.id,
      modifiers: wire.modifiers.map((modifier, index) =>
        parseModifier(manager, modifier, index, `${pathPrefix}.modifiers`),
      ),
      duration: parseDuration(manager, wire.duration, pathPrefix),
      grantedTags: wire.grantedTags?.map((tag, index) =>
        resolveTagName(manager, tag, `${pathPrefix}.grantedTags[${index}]`),
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
  manager: GameplayTagManager,
): GameplayAbilityDefinition {
  if (!wire.id) {
    throw new DefinitionParseError('GameplayAbilityDefinition.id is required');
  }

  return {
    id: wire.id,
    kind: wire.kind,
    name: wire.name,
    tags: wire.tags,
    cost: wire.cost,
    chargeCostOnActivate: wire.chargeCostOnActivate,
    endPolicy: wire.endPolicy,
    effectsOnActivate: wire.effectsOnActivate.map((binding, index) => ({
      target: binding.target,
      effect: parseGameplayEffectDefinition(
        binding.effect,
        manager,
        `effectsOnActivate[${index}].effect`,
      ),
    })),
    listenWhileActive: wire.listenWhileActive,
    handlerId: wire.handlerId,
    autoActivateOnGrant: wire.autoActivateOnGrant,
    passiveTrigger: wire.passiveTrigger,
  };
}
