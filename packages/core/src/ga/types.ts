import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';

export type GameplayAbilityKind = 'active' | 'passive';

/** Who ends an Active instance after activate effects run. */
export type GameplayAbilityEndPolicy = 'auto' | 'manual';

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

/** Event filter shared by grant-time passive shim and Active-instance listening. */
export type GameplayAbilityEventListen = {
  channelTag?: string;
  eventTags: readonly string[];
  match?: 'all' | 'any';
  /** Soft equality against event.payload keys (missing payload key = no match). */
  payloadMatch?: Readonly<Record<string, string | number | boolean>>;
};

/** @deprecated Prefer listenWhileActive + autoActivateOnGrant; kept as F08 passiveTrigger alias. */
export type GameplayAbilityPassiveTrigger = GameplayAbilityEventListen;

export type GameplayAbilityBuiltinActivation = 'combat.takeDamage';

export type GameplayAbilityDefinition = {
  id: string;
  kind: GameplayAbilityKind;
  name?: string;
  tags: GameplayAbilityTagGates;
  cost?: GameplayAbilityCost;
  /** Default true. Set false when cost is paid on a later commit event (card preview). */
  chargeCostOnActivate?: boolean;
  /**
   * `auto` (default): end after Instant-only activate effects (F08 behavior).
   * `manual`: stay Active until `endAbility` (card preview / long-lived listens).
   */
  endPolicy?: GameplayAbilityEndPolicy;
  effectsOnActivate: readonly GameplayAbilityEffectBinding[];
  /** Core-resolved activation when effects alone are insufficient (e.g. TakeDamage sampling). */
  builtinActivation?: GameplayAbilityBuiltinActivation;
  /** While this activation is Active, subscribe and notify host on match. */
  listenWhileActive?: GameplayAbilityEventListen;
  /**
   * After grant, immediately tryActivate with a minimal self context.
   * Together with listenWhileActive, this is the UE-aligned “passive” shape.
   */
  autoActivateOnGrant?: boolean;
  /** F08 shim: grant-time listen that tryActivates on match (kind === 'passive'). */
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

export type TakeDamageActivationData = {
  blocked: number;
  healthLost: number;
};

export type ActivationResult =
  | { ok: true; instanceId: string; activationData?: { takeDamage?: TakeDamageActivationData } }
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

export type ActiveAbilityEventInfo = {
  instanceId: string;
  handle: string;
  abilityDefId: string;
  event: GameplayEvent;
};

export class GameplayAbilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameplayAbilityError';
  }
}
