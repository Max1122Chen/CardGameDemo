import type { GameplayAbilityDefinition } from '../ga/types.js';
import type { GameplayEffectDefinition } from '../gfc/types.js';
import type { CardActionId } from './types.js';

export type CardTargeting = 'none' | 'self' | 'single_enemy';

export type CardCommitEffectTarget = 'self' | 'target';

export type CardDefinition = {
  id: CardActionId;
  name: string;
  cost: number;
  targeting: CardTargeting;
  ability: GameplayAbilityDefinition;
  commitEffects?: readonly {
    target: CardCommitEffectTarget;
    effect: GameplayEffectDefinition;
  }[];
  /** After commitEffects, activate TakeDamage GA on the preview target entity. */
  settleTakeDamageOnTarget?: boolean;
  /** Commit Block from BlockToGain preview meta on self. */
  applyBlockFromPreview?: boolean;
};
