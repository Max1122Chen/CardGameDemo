import type { GameplayEvent } from '../events/gameplay-event.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import type {
  AbilityParameterSchema,
  AbilityParameterValue,
} from './parameter-binding.js';

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

export type GameplayAbilityEffectTarget = 'self' | 'target';

/** Data-driven GE apply with `$Param` → SetByCaller bindings (CORE-F12). */
export type GameplayAbilityEffectBindingSpec = {
  /** Filter key; hooks apply subsets (e.g. `preview` | `commit`). */
  when?: string;
  effect: GameplayEffectDefinition;
  target: GameplayAbilityEffectTarget;
  bind?: Readonly<Record<string, string>>;
};

/** Event filter for hook `startListen`. */
export type GameplayAbilityEventListen = {
  channelTag?: string;
  eventTags: readonly string[];
  match?: 'all' | 'any';
  /** Soft equality against event.payload keys (missing payload key = no match). */
  payloadMatch?: Readonly<Record<string, string | number | boolean>>;
};

export type GameplayAbilityDefinition = {
  id: string;
  kind: GameplayAbilityKind;
  name?: string;
  tags: GameplayAbilityTagGates;
  /** Cost GE applied via checkCost / applyCost / commitAbility. */
  costEffect?: GameplayEffectDefinition;
  /** `$Param` → SetByCaller keys for cost GE. */
  costBindings?: Readonly<Record<string, string>>;
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
  | 'missing_source';

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
