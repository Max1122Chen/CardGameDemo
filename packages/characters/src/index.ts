export type {
  CharacterDefinition,
  CharacterEquipmentSpawn,
  CharacterInstance,
  CharacterInventorySpawn,
  CharacterLootEntry,
  CharacterLootProfile,
  CharacterCatalog,
  PrimaryStats,
  SpawnContext,
} from './types.js';
export { CharacterParseError, CharacterSpawnError } from './errors.js';
export {
  buildCharacterCatalog,
  parseCharacterDefinition,
  type WireCharacterDefinition,
} from './parse-character.js';
export {
  loadBehaviorTreeIds,
  loadCharacterWiresFromDir,
  resolveRepoDataRoot,
  spawnCharacterById,
  spawnCharacterInstance,
} from './spawn.js';
export { loadCharacterCatalogFromRepo } from './catalog.js';
