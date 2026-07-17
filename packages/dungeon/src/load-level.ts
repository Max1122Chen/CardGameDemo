import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LevelParseError } from './errors.js';
import { parseLevelDefinition, type WireLevelDefinition } from './parse-level.js';
import type { LevelAsset } from './types.js';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'dungeon-levels')) || existsSync(join(dir, 'data', 'cards'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/)');
}

export function resolveRepoDataRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  return join(findRepoRoot(startDir), 'data');
}

export function loadLevelById(dataRoot: string, levelId: string): LevelAsset {
  const dir = join(dataRoot, 'dungeon-levels');
  if (!existsSync(dir)) {
    throw new LevelParseError(`Dungeon levels directory missing: ${dir}`);
  }

  for (const name of readdirSync(dir).filter((entry) => entry.endsWith('.json'))) {
    const wire = JSON.parse(readFileSync(join(dir, name), 'utf8')) as WireLevelDefinition;
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
