import type { GameplayAbilityDefinition } from '@cardgame/core';
import { TAKE_DAMAGE_ABILITY_ID, TAKE_DAMAGE_HANDLER_ID } from './set-by-caller-keys.js';

export { TAKE_DAMAGE_ABILITY_ID };

/** Matches `data/abilities/take-damage.json` (JSON is production source; this is bootstrap helper). */
export function createTakeDamageAbilityDefinition(): GameplayAbilityDefinition {
  return {
    id: TAKE_DAMAGE_ABILITY_ID,
    kind: 'active',
    name: 'TakeDamage',
    tags: {},
    costApplyTiming: 'manual',
    endPolicy: 'auto',
    effectsOnActivate: [],
    handlerId: TAKE_DAMAGE_HANDLER_ID,
    parameterSchema: {},
  };
}
