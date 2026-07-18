export type {
  AdventureExploreAction,
  AdventurePhase,
  CellCoord,
  LevelAsset,
  LevelDoor,
  LevelGenProfile,
  LevelPhase,
  LevelSource,
  RoomDefinition,
  RoomDirection,
  RoomEncounter,
  RoomGroundLootEntry,
  RoomKind,
  RoomRect,
  RoomRuntimeState,
} from './types.js';
export {
  DEFAULT_DOOR_COST,
  DEFAULT_DUNGEON_LEVEL_COUNT,
  DEFAULT_EXPLORE_MAX_AP,
  ROOM_DIRECTIONS,
  oppositeDirection,
} from './types.js';
export { AdventureError, LevelParseError } from './errors.js';
export {
  parseLevelDefinition,
  type WireLevelDefinition,
  type WireRoomDefinition,
} from './parse-level.js';
export { loadLevelById, loadLevelFromRepo, resolveRepoDataRoot } from './load-level.js';
export {
  createSeededRng,
  createVirtualBattleLevel,
  defaultDungeonGenProfile,
  generateDefaultDungeonLevel,
  generateLevel,
} from './generate-level.js';
export {
  buildOccupancy,
  cellKey,
  cellsInRect,
  directionBetween,
  findDoorBetween,
  normalizeLevelAsset,
  resolveRoomRect,
  sharedWallPairs,
  stepCell,
  stepMovementCost,
} from './level-geometry.js';
export {
  AdventureSession,
  seedForLevel,
  type AdventureSnapshot,
  type AdventureSessionOptions,
  type AdventureRunOptions,
} from './adventure-session.js';
export {
  LevelSession,
  type LevelSnapshot,
  type LevelSessionOptions,
} from './level-session.js';
export {
  AdventureLifecycleBus,
  type AdventureLifecycleEvent,
  type AdventureLifecycleEventType,
  type AdventureLifecycleListener,
} from './lifecycle.js';
export {
  beginAdventureCombat,
  finishAdventureCombat,
  type AdventureCombatHostConfig,
  type FinishAdventureCombatOptions,
} from './combat-bridge.js';
export {
  createAbandonedForge,
  createBeggar,
  createBloodAltar,
  createLifeFountain,
  createMemoryInteractionHost,
  createSpikeTrap,
  defaultGeneratedInteractables,
  defaultProbeInteractables,
  formatD20Check,
  rollD20Check,
  type D20CheckInput,
  type D20CheckResult,
  type DialogueFrame,
  type DialogueOption,
  type DiceAdvantage,
  type Interactable,
  type InteractableKind,
  type InteractionHost,
  type RoomInteractableView,
} from './interaction/index.js';
export {
  activateDungeonMove,
  ensureExplorePlayerForMove,
  ensureDungeonMoveAbility,
  loadDungeonMoveAbility,
  registerDungeonAbilityHandlers,
  DUNGEON_MOVE_ABILITY_ID,
  DUNGEON_MOVE_HANDLER_ID,
  type DungeonMoveBridge,
} from './move-ability.js';
