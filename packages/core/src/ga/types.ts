import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';

export type GameplayAbilityKind = 'active' | 'passive';

export type GameplayAbilityTagGates = {
  activationRequiredTags?: readonly string[];
  activationBlockedTags?: readonly string[];
  sourceRequiredTags?: readonly string[];
  sourceBlockedTags?: readonly string[];
  targetRequiredTags?: readonly string[];
  targetBlockedTags?: readonly string[];
  abilityTags?: readonly string[];
};

export type GameplayAbilityCost = {
  attribute: string;
  amount: number;
};

export type GameplayAbilityEffectTarget = 'self' | 'target';

export type GameplayAbilityEffectBinding = {
  target: GameplayAbilityEffectTarget;
  effect: GameplayEffectDefinition;
};

export type GameplayAbilityPassiveTrigger = {
  channelTag?: string;
  eventTags: readonly string[];
  match?: 'all' | 'any';
};

export type GameplayAbilityDefinition = {
  id: string;
  kind: GameplayAbilityKind;
  name?: string;
  tags: GameplayAbilityTagGates;
  cost?: GameplayAbilityCost;
  effectsOnActivate: readonly GameplayAbilityEffectBinding[];
  passiveTrigger?: GameplayAbilityPassiveTrigger;
};

export type AbilityActivationContext = {
  instigatorEntityId: EntityId;
  sourceEntityId?: EntityId;
  targetEntityId?: EntityId;
  event?: GameplayEvent;
  payload?: Record<string, unknown>;
};

export type ActivationFailureReason =
  | 'not_granted'
  | 'cannot_activate'
  | 'missing_target'
  | 'missing_source'
  | 'insufficient_cost';

export type ActivationResult =
  | { ok: true; instanceId: string }
  | { ok: false; reason: ActivationFailureReason };

export type GrantedAbilitySnapshot = {
  handle: string;
  abilityDefId: string;
  kind: GameplayAbilityKind;
  name?: string;
};

export type ActiveAbilitySnapshot = {
  instanceId: string;
  handle: string;
  abilityDefId: string;
};

export class GameplayAbilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayAbilityError';
  }
}
