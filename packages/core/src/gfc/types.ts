import type { GameplayEventChannel } from '../events/gameplay-event-channel.js';
import type { EntityId } from '../engine/component-type.js';
import type { GameplayTag } from '../tags/gameplay-tag.js';

export type AttributeValue = {
  baseValue: number;
  currentValue: number;
};

export type AttributeChangeContext = {
  entityId: EntityId;
  attribute: string;
  oldValue: number;
  newValue: number;
};

export type AttributeChangeCallback = (ctx: AttributeChangeContext) => void;

export type GameplayModifierOp = 'Add' | 'Multiply' | 'Override';

export type GameplayModifierMagnitude =
  | { kind: 'Scalable'; value: number }
  | {
      kind: 'AttributeBased';
      captureFrom: 'Source' | 'Target';
      attribute: string;
      valueKind: 'Base' | 'Current';
      coefficient?: number;
    };

export type GameplayEffectModifier = {
  attribute: string;
  op: GameplayModifierOp;
  magnitude: number | GameplayModifierMagnitude;
  evaluationStage?: GameplayTag;
};

export type GameplayEffectApplicationContext = {
  instigatorEntityId: EntityId;
  sourceEntityId?: EntityId;
  targetEntityId?: EntityId;
  payload?: Record<string, unknown>;
};

export type AttributeEvaluationPipeline = {
  attribute: string;
  stageOrder: readonly GameplayTag[];
};

export type GameplayEffectDuration =
  | { kind: 'Instant' }
  | { kind: 'Infinite' }
  | {
      kind: 'Duration';
      unitTag: GameplayTag;
      magnitude: number;
      channels?: readonly GameplayEventChannel[];
    };

/** While applied, gates must pass on source/target tag containers for modifiers/tags to contribute. */
export type OngoingTagRequirements = {
  sourceRequiredTags?: readonly string[];
  sourceBlockedTags?: readonly string[];
  targetRequiredTags?: readonly string[];
  targetBlockedTags?: readonly string[];
};

export type GameplayEffectStacking =
  | { kind: 'none' }
  | {
      kind: 'byEffectId';
      onReapply: 'addDuration' | 'refreshDuration' | 'addMagnitude';
    };

export type GameplayEffectDefinition = {
  id: string;
  modifiers: readonly GameplayEffectModifier[];
  duration: GameplayEffectDuration;
  grantedTags?: readonly GameplayTag[];
  ongoingTagRequirements?: OngoingTagRequirements;
  stacking?: GameplayEffectStacking;
};

export type ActiveGameplayEffect = {
  id: string;
  definition: GameplayEffectDefinition;
  applicationOrder: number;
  applicationContext: GameplayEffectApplicationContext;
  durationProgress?: number;
  /** Effective Duration magnitude after stack merges (`addDuration`). */
  stackedDurationMagnitude?: number;
  /** False when ongoing gates fail; modifiers and granted tags do not contribute. */
  ongoingContributing: boolean;
  durationChannels: readonly GameplayEventChannel[];
};

export type GfcTagSnapshot = {
  name: string;
  count: number;
};

export type GfcAttributeSnapshot = {
  attribute: string;
  baseValue: number;
  currentValue: number;
};

export type ActiveGameplayEffectSnapshot = {
  id: string;
  definitionId: string;
  durationKind: GameplayEffectDuration['kind'];
  durationProgress?: number;
  durationTarget?: number;
  durationChannels: string[];
  ongoingContributing?: boolean;
  stackedDurationMagnitude?: number;
};

export type GfcSnapshot = {
  entityId: EntityId;
  tags: GfcTagSnapshot[];
  attributes: GfcAttributeSnapshot[];
  activeEffects: ActiveGameplayEffectSnapshot[];
  grantedAbilities: GrantedAbilitySnapshot[];
  activeAbilities: ActiveAbilitySnapshot[];
};

export type GrantedAbilitySnapshot = {
  handle: string;
  abilityDefId: string;
  kind: 'active' | 'passive';
  name?: string;
};

export type ActiveAbilitySnapshot = {
  instanceId: string;
  handle: string;
  abilityDefId: string;
};
