import type { PrimaryStats } from '@cardgame/characters';

import type { PrimaryAttributeBlock } from './combat-attributes.js';
import { CombatAttributes } from './combat-attributes.js';

export function characterPrimariesToCombat(primaries: PrimaryStats): PrimaryAttributeBlock {
  return {
    [CombatAttributes.Strength]: primaries.strength,
    [CombatAttributes.Constitution]: primaries.constitution,
    [CombatAttributes.Dexterity]: primaries.dexterity,
    [CombatAttributes.Intelligence]: primaries.intelligence,
    [CombatAttributes.Wisdom]: primaries.wisdom,
    [CombatAttributes.Charisma]: primaries.charisma,
  };
}
