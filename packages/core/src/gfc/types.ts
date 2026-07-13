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

export type GameplayEffectModifier = {
  attribute: string;
  op: GameplayModifierOp;
  magnitude: number;
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

export type GameplayEffectDefinition = {
  id: string;
  modifiers: readonly GameplayEffectModifier[];
  duration: GameplayEffectDuration;
  grantedTags?: readonly GameplayTag[];
};

export type ActiveGameplayEffect = {
  id: string;
  definition: GameplayEffectDefinition;
  applicationOrder: number;
  durationProgress?: number;
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
