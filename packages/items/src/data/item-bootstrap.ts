import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { GameplayTagManager } from '@cardgame/core';

import type { ItemDefinition, ItemId } from '../item-definition.js';
import {
  buildItemCatalog,
  collectItemTagNames,
  type WireItemDefinition,
} from './parse-item.js';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'items'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/items)');
}

export function resolveRepoDataRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  return join(findRepoRoot(startDir), 'data');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadItemWiresFromDir(itemsDir: string): WireItemDefinition[] {
  if (!existsSync(itemsDir)) {
    return [];
  }
  const files = readdirSync(itemsDir)
    .filter((name) => name.endsWith('.json'))
    .sort();
  return files.map((name) => readJsonFile<WireItemDefinition>(join(itemsDir, name)));
}

export type BattleRewardEntry = {
  itemId: string;
  quantity: number;
};

export type BattleRewardsTable = {
  id: string;
  entries: readonly BattleRewardEntry[];
};

export function loadBattleRewards(dataRoot: string, tableId = 'default'): BattleRewardsTable {
  const path = join(dataRoot, 'combat', 'battle-rewards.json');
  const tables = readJsonFile<Record<string, BattleRewardsTable>>(path);
  const table = tables[tableId];
  if (!table) {
    throw new Error(`Unknown battle rewards table: ${tableId}`);
  }
  return table;
}

export function loadItemCatalogFromRepo(
  manager: GameplayTagManager,
  options: { dataRoot?: string } = {},
): Record<ItemId, ItemDefinition> {
  const dataRoot = options.dataRoot ?? resolveRepoDataRoot();
  const wires = loadItemWiresFromDir(join(dataRoot, 'items'));
  return buildItemCatalog(wires, manager);
}

export function collectItemTagsFromRepo(dataRoot?: string): string[] {
  const root = dataRoot ?? resolveRepoDataRoot();
  return collectItemTagNames(loadItemWiresFromDir(join(root, 'items')));
}
