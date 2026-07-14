export { CombatSession } from './combat-session.js';
export { CombatError } from './errors.js';
export { CombatAttributes } from './combat-attributes.js';
export { settleTakeDamage, resetCombatMeta, bootstrapCombatAttributes } from './take-damage.js';
export { createTakeDamageAbilityDefinition, TAKE_DAMAGE_ABILITY_ID } from './take-damage-ability.js';
export { settleTakeDamageOnEntity } from './settle-take-damage.js';
export { registerCombatAbilityHandlers } from './register-combat-abilities.js';
export {
  SetByCallerKeys,
  CommitMode,
  CARD_PLAY_HANDLER_ID,
  TAKE_DAMAGE_HANDLER_ID,
  CARD_PLAY_ABILITY_ID,
} from './set-by-caller-keys.js';
export type { CardDefinition, CardTargeting } from './card-definition.js';
export {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  CARD_ACTION_IDS,
  type CardActionId,
  type CardActionSpec,
  type CardInstance,
  type CardView,
  type CombatAction,
  type CombatPhase,
  type CombatPreviewSnapshot,
  type CombatResult,
  type CombatSessionConfig,
  type CombatSessionTuneables,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DeckState,
  type EnemyIntent,
} from './types.js';
