import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RuleEngine } from '@cardgame/core';
import type { GameplayTagManager } from '@cardgame/core';
import type { CombatSessionTuneables } from '../types.js';
import type { WireGameplayAbilityDefinition, WireGameplayEffectDefinition } from '@cardgame/core';
import {
  buildCombatCardBootstrap,
  type CombatCardBootstrap,
  type DefinitionAssetCatalog,
  type WireCardDefinition,
} from './parse-card.js';

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

function loadJsonDir<T extends { id: string }>(dir: string): Record<string, T> {
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

export function loadDefinitionAssetCatalog(dataRoot: string): DefinitionAssetCatalog {
  return {
    effects: loadJsonDir<WireGameplayEffectDefinition>(join(dataRoot, 'effects')),
    abilities: loadJsonDir<WireGameplayAbilityDefinition>(join(dataRoot, 'abilities')),
  };
}

export function loadCardWiresFromDir(cardsDir: string): WireCardDefinition[] {
  const files = readdirSync(cardsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  return files.map((name) => readJsonFile<WireCardDefinition>(join(cardsDir, name)));
}

export function loadDeckIds(decksDir: string, deckName = 'starter'): readonly string[] {
  const path = join(decksDir, `${deckName}.json`);
  return readJsonFile<readonly string[]>(path);
}

export function loadCombatBootstrapFromRepo(
  manager: GameplayTagManager,
  options: { dataRoot?: string; deckName?: string } = {},
): CombatCardBootstrap {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  const catalog = loadDefinitionAssetCatalog(dataRoot);
  const wires = loadCardWiresFromDir(join(dataRoot, 'cards'));
  const deckIds = loadDeckIds(join(dataRoot, 'decks'), options.deckName);
  return buildCombatCardBootstrap(wires, deckIds, manager, catalog);
}

export function combatBootstrapConfig(
  engine: RuleEngine,
  tuneables: Partial<CombatSessionTuneables> = {},
): Partial<CombatSessionTuneables> &
  Pick<import('../types.js').CombatSessionConfig, 'cardCatalog' | 'deckIds'> {
  return { ...loadCombatBootstrapFromRepo(engine.tagManager), ...tuneables };
}
