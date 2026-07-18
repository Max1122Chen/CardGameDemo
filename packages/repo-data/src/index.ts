import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Walk upward until we find a monorepo root that owns `data/`.
 * Accepts any of the common asset markers so packages need not diverge.
 */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    const dataDir = join(dir, 'data');
    if (
      existsSync(join(dataDir, 'cards')) ||
      existsSync(join(dataDir, 'items')) ||
      existsSync(join(dataDir, 'characters')) ||
      existsSync(join(dataDir, 'dungeon-levels'))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/ cards|items|characters|dungeon-levels)');
}

/** Absolute path to the repo `data/` directory. */
export function resolveRepoDataRoot(
  startDir = dirname(fileURLToPath(import.meta.url)),
): string {
  return join(findRepoRoot(startDir), 'data');
}

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

/** Load `*.json` objects that have an `id` field into a Record keyed by id. */
export function loadJsonDirById<T extends { id: string }>(dir: string): Record<string, T> {
  if (!existsSync(dir)) {
    return {};
  }
  const out: Record<string, T> = {};
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
    const wire = readJsonFile<T>(join(dir, name));
    out[wire.id] = wire;
  }
  return out;
}

/** Load all `*.json` files in a directory (sorted), regardless of id. */
export function loadJsonFiles<T>(dir: string): T[] {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJsonFile<T>(join(dir, name)));
}
