import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import type {
  AbilityParameterSchema,
  AbilityParameterValue,
} from './parameter-binding.js';

export type GameplayAbilityKind = 'active' | 'passive';

/** Who ends an Active instance after activate effects run. */
export type GameplayAbilityEndPolicy = 'auto' | 'manual';

/** When Cost GE is applied (UE CommitAbility timing). */
export type GameplayAbilityCostApplyTiming = 'activate' | 'manual';

export type GameplayAbilityTagGates = {
  activationRequiredTags?: readonly string[];
  activationBlockedTags?: readonly string[];
  sourceRequiredTags?: readonly string[];
  sourceBlockedTags?: readonly string[];
  targetRequiredTags?: readonly string[];
  targetBlockedTags?: readonly string[];
  abilityTags?: readonly string[];
};

/**
 * @deprecated CORE-F12 — prefer `costEffect` + `costBindings`. Kept for transitional tests.
 */
export type GameplayAbilityCost = {
  attribute: string;
  amount: number;
};

export type GameplayAbilityEffectTarget = 'self' | 'target';

export type GameplayAbilityEffectBinding = {
  target: GameplayAbilityEffectTarget;
  effect: GameplayEffectDefinition;
};

/** Data-driven GE apply with `$Param` → SetByCaller bindings (CORE-F12). */
export type GameplayAbilityEffectBindingSpec = {
  /** Filter key; hooks apply subsets (e.g. `preview` | `commit`). */
  when?: string;
  effect: GameplayEffectDefinition;
  target: GameplayAbilityEffectTarget;
  bind?: Readonly<Record<string, string>>;
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

export type GameplayAbilityDefinition = {
  id: string;
  kind: GameplayAbilityKind;
  name?: string;
  tags: GameplayAbilityTagGates;
  /**
   * @deprecated Prefer `costEffect` + `costBindings` (CORE-F12).
   */
  cost?: GameplayAbilityCost;
  /**
   * @deprecated Prefer `costApplyTiming: 'manual'` (CORE-F12).
   * Default true when using legacy `cost`.
   */
  chargeCostOnActivate?: boolean;
  /** Cost GE applied via checkCost / applyCost / commitAbility. */
  costEffect?: GameplayEffectDefinition;
  /** `$Param` → SetByCaller keys for cost GE. */
  costBindings?: Readonly<Record<string, string>>;
  /** Default `activate`. Card preview uses `manual` (pay on TryPlay). */
  costApplyTiming?: GameplayAbilityCostApplyTiming;
  /**
   * `auto` (default): end after Instant-only activate effects (F08 behavior).
   * `manual`: stay Active until `endAbility` (card preview / long-lived listens).
   */
  endPolicy?: GameplayAbilityEndPolicy;
  effectsOnActivate: readonly GameplayAbilityEffectBinding[];
  /** Parameterized effect applies (preview/commit); resolved at load. */
  effectBindings?: readonly GameplayAbilityEffectBindingSpec[];
  /** Declared parameter schema (CDO defaults). */
  parameterSchema?: AbilityParameterSchema;
  /** Merged CDO + overrides for this grant/card instance. */
  parameterValues?: Readonly<Record<string, AbilityParameterValue>>;
  /**
   * App-registered activation hook id (CORE-F11/F12).
   * Core dispatches via AbilityActivationRegistry; combat logic stays out of core.
   */
  handlerId?: string;
  /**
   * @deprecated Prefer hook `startListen` (CORE-F12). Kept as optional sugar / F08 path.
   */
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
  /** SetByCaller map for GE magnitudes applied during this activation. */
  setByCaller?: Readonly<Record<string, number>>;
  /** Instance parameters for this activation (overrides definition.parameterValues). */
  parameters?: Readonly<Record<string, AbilityParameterValue>>;
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
  | {
      ok: true;
      instanceId: string;
      activationData?: Record<string, unknown> & { takeDamage?: TakeDamageActivationData };
    }
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

export type {
  AbilityParameterSchema,
  AbilityParameterSchemaEntry,
  AbilityParameterValue,
} from './parameter-binding.js';
