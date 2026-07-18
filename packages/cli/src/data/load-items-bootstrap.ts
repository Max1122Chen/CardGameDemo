import {
  collectItemTagsFromRepo,
  loadBattleRewards,
  loadItemCatalogFromRepo,
  resolveRepoDataRoot,
  validateBattleRewards,
  type ItemDefinition,
} from '@cardgame/items';
import type { GameplayTagManager } from '@cardgame/core';

export function loadItemBootstrap(manager: GameplayTagManager): Record<string, ItemDefinition> {
  const dataRoot = resolveRepoDataRoot();
  const catalog = loadItemCatalogFromRepo(manager, { dataRoot });
  const rewards = loadBattleRewards(dataRoot);
  validateBattleRewards(rewards, catalog);
  return catalog;
}

export function loadItemTagDefinitions(): string[] {
  return collectItemTagsFromRepo(resolveRepoDataRoot());
}
