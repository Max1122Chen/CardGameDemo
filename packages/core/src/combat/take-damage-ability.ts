import type { GameplayAbilityDefinition } from '../ga/types.js';

export const TAKE_DAMAGE_ABILITY_ID = 'ga.combat.take-damage';

export function createTakeDamageAbilityDefinition(): GameplayAbilityDefinition {
  return {
    id: TAKE_DAMAGE_ABILITY_ID,
    kind: 'active',
    name: 'TakeDamage',
    tags: {},
    chargeCostOnActivate: false,
    effectsOnActivate: [],
    handlerId: 'combat.takeDamage',
  };
}
