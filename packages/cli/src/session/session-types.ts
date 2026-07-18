import type { CombatSession, CombatSnapshot } from '@cardgame/combat';
import type { RuleEngine } from '@cardgame/core';
import type { AdventureSession } from '@cardgame/dungeon';
import type {
  EquipmentLoadout,
  InventoryState,
  ItemDefinition,
  PendingLootState,
} from '@cardgame/items';

import type { AppState } from '../types.js';

export type SessionController = {
  engine: RuleEngine;
  /** Null while adventure is in explore / between fights. */
  combatSession: CombatSession | null;
  adventure: AdventureSession | null;
  sessionKind: 'standalone' | 'adventure';
  itemCatalog: Record<string, ItemDefinition>;
  inventory: InventoryState;
  loadout: EquipmentLoadout;
  baseDeckIds: readonly string[];
  enemyCharacterId: string;
  pendingLoot: PendingLootState;
  lootSpawned: boolean;
  traceLines: string[];
  /** Standalone or battle-only restart. */
  bootstrapBattle: (enemyCharacterId?: string) => void;
  /** Start / restart a dungeon level adventure. */
  startDungeon: (levelId?: string) => void;
  syncViewState: (state: AppState) => AppState;
  getCombatSnapshot: () => CombatSnapshot;
};
