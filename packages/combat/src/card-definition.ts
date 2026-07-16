import type { GameplayAbilityDefinition } from '@cardgame/core';

import type { AttributeBonusSpec } from './attribute-bonus.js';

export type CardTargeting = 'none' | 'self' | 'single_enemy';

export type CardDefinition = {
  id: string;
  name: string;
  cost: number;
  targeting: CardTargeting;
  ability: GameplayAbilityDefinition;
  attributeBonus?: AttributeBonusSpec;
};

/** @deprecated Prefer effectBindings when=commit */
export type CardCommitEffectTarget = 'self' | 'target';
