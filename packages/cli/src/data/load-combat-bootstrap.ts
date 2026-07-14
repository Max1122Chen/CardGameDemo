import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCombatCardBootstrap,
  type CombatCardBootstrap,
  type CombatSessionTuneables,
  type RuleEngine,
  type WireCardDefinition,
} from '@cardgame/core';

const CARD_FILE_NAMES = [
  'strike.json',
  'defend.json',
  'bash.json',
  'weaken.json',
  'flex.json',
  'wait.json',
] as const;

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'cards'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/cards)');
}

export function resolveRepoDataRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  return join(findRepoRoot(startDir), 'data');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadCardWiresFromDir(cardsDir: string): WireCardDefinition[] {
  const files = readdirSync(cardsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();

  if (files.length === 0) {
    for (const name of CARD_FILE_NAMES) {
      const path = join(cardsDir, name);
      if (!existsSync(path)) {
        throw new Error(`Missing card asset: ${path}`);
      }
    }
  }

  const names = files.length > 0 ? files : [...CARD_FILE_NAMES];
  return names.map((name) => readJsonFile<WireCardDefinition>(join(cardsDir, name)));
}

export function loadDeckIds(decksDir: string, deckName = 'starter'): readonly string[] {
  const path = join(decksDir, `${deckName}.json`);
  return readJsonFile<readonly string[]>(path);
}

export function loadCombatBootstrapFromRepo(
  engine: RuleEngine,
  options: { dataRoot?: string; deckName?: string } = {},
): CombatCardBootstrap {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  const wires = loadCardWiresFromDir(join(dataRoot, 'cards'));
  const deckIds = loadDeckIds(join(dataRoot, 'decks'), options.deckName);
  return buildCombatCardBootstrap(wires, deckIds, engine.tagManager);
}

export function combatBootstrapConfig(
  engine: RuleEngine,
  tuneables: Partial<CombatSessionTuneables> = {},
): Partial<CombatSessionTuneables> &
  Pick<
    import('@cardgame/core').CombatSessionConfig,
    'cardCatalog' | 'deckIds'
  > {
  return { ...loadCombatBootstrapFromRepo(engine), ...tuneables };
}
