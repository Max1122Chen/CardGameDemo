export { CombatSession } from './combat-session.js';
export { CombatError } from './errors.js';
export { CombatAttributes } from './combat-attributes.js';
export { settleTakeDamage, resetCombatMeta, bootstrapCombatAttributes } from './take-damage.js';
export { settleTakeDamageOnEntity } from './settle-take-damage.js';
export { dealDamageToEntity } from './deal-damage.js';
export { dealOutgoingDamage } from './deal-outgoing-damage.js';
export { registerCombatAbilityHandlers } from './register-combat-abilities.js';
export {
  computeAttributeBonus,
  computeAttributeBonusForEntity,
  loadAttributeBonusConfig,
  readPrimaryBlock,
  type AttributeBonusConfig,
  type AttributeBonusGrade,
  type AttributeBonusSpec,
} from './attribute-bonus.js';
export {
  DEFAULT_ENEMY_PRIMARIES,
  DEFAULT_PLAYER_PRIMARIES,
} from './combat-attributes.js';
export {
  SetByCallerKeys,
  TAKE_DAMAGE_HANDLER_ID,
  TAKE_DAMAGE_ABILITY_ID,
  CARD_PLAY_DAMAGE_ABILITY_ID,
  CARD_PLAY_BLOCK_ABILITY_ID,
  CARD_PLAY_STATUS_ABILITY_ID,
  CARD_PLAY_HEAL_ABILITY_ID,
} from './set-by-caller-keys.js';
export {
  CARD_PLAY_DAMAGE_HANDLER_ID,
  CARD_PLAY_BLOCK_HANDLER_ID,
  CARD_PLAY_STATUS_HANDLER_ID,
  CARD_PLAY_HEAL_HANDLER_ID,
  type CardPlayCommitBridge,
} from './card-play-handlers.js';
export type { CardDefinition, CardTargeting, CardCommitEffectTarget } from './card-definition.js';
export {
  COMBAT_ENEMY_ID,
  COMBAT_PLAYER_ID,
  DEFAULT_COMBAT_CONFIG,
  CARD_ACTION_IDS,
  type CardId,
  type CardActionId,
  type CardActionSpec,
  type CardInstance,
  type CardView,
  type CombatAction,
  type CombatPhase,
  type CombatPreviewSnapshot,
  type CombatResult,
  type DamageBreakdown,
  type ActorSnapshot,
  type CombatSessionConfig,
  type CombatSessionTuneables,
  type CombatSnapshot,
  type CombatTurnOwner,
  type DeckState,
  type EnemyIntent,
} from './types.js';
export {
  parseCardDefinition,
  buildCardCatalog,
  buildCombatCardBootstrap,
  catalogToDisplaySpecs,
  type WireCardDefinition,
  type WireCardCommitEffect,
  type WireCardCommitEffectRef,
  type CombatCardBootstrap,
  type DefinitionAssetCatalog,
} from './data/parse-card.js';
export {
  loadCombatBootstrapFromRepo,
  loadDefinitionAssetCatalog,
  loadCardWiresFromDir,
  loadDeckIds,
  resolveRepoDataRoot,
  combatBootstrapConfig,
} from './data/combat-bootstrap.js';
