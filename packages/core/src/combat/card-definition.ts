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
  /** Runtime SetByCaller map (Damage, BlockToGain, CommitMode, …). */
  setByCaller?: Readonly<Record<string, number>>;
  /** Status / buff GEs applied on commit (resolved from asset refs at load). */
  commitEffects?: readonly {
    target: CardCommitEffectTarget;
    effect: GameplayEffectDefinition;
  }[];
};
