import type { CharacterInstance } from '@cardgame/characters';
import {
  loadBehaviorTreeIds,
  loadCharacterCatalogFromRepo,
  resolveRepoDataRoot as resolveCharacterDataRoot,
  spawnCharacterById,
} from '@cardgame/characters';
import type { BehaviorTreeAsset } from '@cardgame/core';
import type { ItemDefinition } from '@cardgame/items';

import { loadBehaviorTreeById } from './load-behavior-tree.js';
import { resolveRepoDataRoot } from './data/combat-bootstrap.js';

export type EnemyCombatSetup = {
  character: CharacterInstance;
  behaviorTree: BehaviorTreeAsset;
};

export function spawnEnemyFromRepo(
  characterId: string,
  itemCatalog: Record<string, ItemDefinition>,
  options: { dataRoot?: string } = {},
): EnemyCombatSetup {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  const catalog = loadCharacterCatalogFromRepo({ dataRoot });
  const behaviorTreeIds = loadBehaviorTreeIds(dataRoot);
  const character = spawnCharacterById(catalog, characterId, {
    itemCatalog,
    behaviorTreeIds,
  });
  const behaviorTree = loadBehaviorTreeById(dataRoot, character.behaviorTreeId);
  return { character, behaviorTree };
}

export { resolveCharacterDataRoot };
