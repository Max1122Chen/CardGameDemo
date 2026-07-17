import { join } from 'node:path';

import { buildCharacterCatalog } from './parse-character.js';
import { loadCharacterWiresFromDir, loadBehaviorTreeIds, resolveRepoDataRoot } from './spawn.js';
import type { CharacterDefinition } from './types.js';

export function loadCharacterCatalogFromRepo(options: { dataRoot?: string } = {}): Record<string, CharacterDefinition> {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  const wires = loadCharacterWiresFromDir(join(dataRoot, 'characters'));
  return buildCharacterCatalog(wires);
}

export { loadBehaviorTreeIds, resolveRepoDataRoot };
