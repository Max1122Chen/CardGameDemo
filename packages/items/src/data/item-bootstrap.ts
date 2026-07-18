import { join } from 'node:path';

import type { GameplayTagManager } from '@cardgame/core';
import { loadJsonFiles, readJsonFile, resolveRepoDataRoot } from '@cardgame/repo-data';

import type { ItemDefinition, ItemId } from '../item-definition.js';
import {
  buildItemCatalog,
  collectItemTagNames,
  type WireItemDefinition,
} from './parse-item.js';

export { resolveRepoDataRoot };

export function loadItemWiresFromDir(itemsDir: string): WireItemDefinition[] {
  return loadJsonFiles<WireItemDefinition>(itemsDir);
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
