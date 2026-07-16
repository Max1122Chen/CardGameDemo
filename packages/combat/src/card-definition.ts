import type { GameplayAbilityDefinition } from '@cardgame/core';
import type { CardId } from './types.js';

export type CardTargeting = 'none' | 'self' | 'single_enemy';

/** @deprecated Prefer effectBindings when=commit */
export type CardCommitEffectTarget = 'self' | 'target';

export type CardDefinition = {
  id: CardId;
  name: string;
  cost: number;
  targeting: CardTargeting;
  /** Ability archetype with merged parameterValues + effectBindings. */
  ability: GameplayAbilityDefinition;
};
