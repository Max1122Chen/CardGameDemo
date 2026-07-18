import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { readJsonFile, resolveRepoDataRoot } from '@cardgame/repo-data';

import { LevelParseError } from './errors.js';
import { parseLevelDefinition, type WireLevelDefinition } from './parse-level.js';
import type { LevelAsset } from './types.js';

export { resolveRepoDataRoot };

export function loadLevelById(dataRoot: string, levelId: string): LevelAsset {
  const dir = join(dataRoot, 'dungeon-levels');
  if (!existsSync(dir)) {
    throw new LevelParseError(`Dungeon levels directory missing: ${dir}`);
  }

  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const wire = readJsonFile<WireLevelDefinition>(join(dir, name));
    if (wire.id === levelId) {
      return parseLevelDefinition(wire);
    }
  }

  throw new LevelParseError(`Level not found: ${levelId}`);
}

export function loadLevelFromRepo(
  levelId: string,
  options: { dataRoot?: string } = {},
): LevelAsset {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  return loadLevelById(dataRoot, levelId);
}
