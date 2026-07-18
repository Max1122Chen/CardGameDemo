import { join } from 'node:path';

import type { RuleEngine, GameplayTagManager } from '@cardgame/core';
import type { ItemDefinition } from '@cardgame/items';
import {
  loadJsonDirById,
  loadJsonFiles,
  readJsonFile,
  resolveRepoDataRoot,
} from '@cardgame/repo-data';
import type { WireGameplayAbilityDefinition, WireGameplayEffectDefinition } from '@cardgame/core';
import type { CombatSessionTuneables } from '../types.js';
import {
  buildCombatCardBootstrap,
  type CombatCardBootstrap,
  type DefinitionAssetCatalog,
  type WireCardDefinition,
} from './parse-card.js';
import { spawnEnemyFromRepo, type EnemyCombatSetup } from '../enemy-bootstrap.js';

export { resolveRepoDataRoot };

export function loadDefinitionAssetCatalog(dataRoot: string): DefinitionAssetCatalog {
  return {
    effects: loadJsonDirById<WireGameplayEffectDefinition>(join(dataRoot, 'effects')),
    abilities: loadJsonDirById<WireGameplayAbilityDefinition>(join(dataRoot, 'abilities')),
  };
}

export function loadCardWiresFromDir(cardsDir: string): WireCardDefinition[] {
  return loadJsonFiles<WireCardDefinition>(cardsDir);
}

export function loadDeckIds(decksDir: string, deckName = 'starter'): readonly string[] {
  return readJsonFile<readonly string[]>(join(decksDir, `${deckName}.json`));
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
  overrides: Partial<CombatSessionTuneables> & {
    deckIds?: readonly string[];
    enemy?: EnemyCombatSetup;
    enemyCharacterId?: string;
    itemCatalog?: Record<string, ItemDefinition>;
  } = {},
): Partial<CombatSessionTuneables> &
  Pick<import('../types.js').CombatSessionConfig, 'cardCatalog' | 'deckIds' | 'takeDamageAbility' | 'enemy'> {
  const base = loadCombatBootstrapFromRepo(engine.tagManager);
  let enemy = overrides.enemy;
  if (!enemy) {
    if (!overrides.itemCatalog) {
      throw new Error('combatBootstrapConfig requires itemCatalog or enemy for data-driven spawn');
    }
    enemy = spawnEnemyFromRepo(overrides.enemyCharacterId ?? 'slime', overrides.itemCatalog);
  }
  return { ...base, ...overrides, enemy };
}
