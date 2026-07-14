export { CombatSession } from './combat-session.js';
export { CombatError } from './errors.js';
export { CombatAttributes } from './combat-attributes.js';
export { settleTakeDamage, resetCombatMeta, bootstrapCombatAttributes } from './take-damage.js';
export { createTakeDamageAbilityDefinition, TAKE_DAMAGE_ABILITY_ID } from './take-damage-ability.js';
export { settleTakeDamageOnEntity } from './settle-take-damage.js';
export { createCardDefinitions } from './card-definitions.js';
export type { CardDefinition, CardTargeting } from './card-definition.js';
export { STARTER_DECK } from './card-catalog.js';
export {
  CARD_CATALOG,
  getCardSpec,
  type CardActionSpec,
} from './card-catalog.js';
export {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  type CardActionId,
  type CardInstance,
  type CardView,
  type CombatAction,
  type CombatPhase,
  type CombatPreviewSnapshot,
  type CombatResult,
  type CombatSessionConfig,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DeckState,
  type EnemyIntent,
} from './types.js';
