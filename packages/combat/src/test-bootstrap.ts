import { RuleEngine } from '@cardgame/core';
import { collectItemTagsFromRepo, loadItemCatalogFromRepo } from '@cardgame/items';

import { combatBootstrapConfig, resolveRepoDataRoot } from './data/combat-bootstrap.js';
import type { CombatSessionTuneables } from './types.js';

export function createProbeCombatEngine(): RuleEngine {
  const dataRoot = resolveRepoDataRoot();
  return RuleEngine.create({
    tagDefinitions: { json: collectItemTagsFromRepo(dataRoot) },
  });
}

export function probeCombatBootstrapConfig(
  engine: RuleEngine,
  overrides: Partial<CombatSessionTuneables> & {
    deckIds?: readonly string[];
    enemyCharacterId?: string;
  } = {},
) {
  const dataRoot = resolveRepoDataRoot();
  const itemCatalog = loadItemCatalogFromRepo(engine.tagManager, { dataRoot });
  return combatBootstrapConfig(engine, {
    enemyHealthOverride: 12,
    itemCatalog,
    ...overrides,
  });
}
