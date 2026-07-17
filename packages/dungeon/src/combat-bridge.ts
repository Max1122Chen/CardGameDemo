import type { RuleEngine } from '@cardgame/core';
import type { ItemDefinition } from '@cardgame/items';
import { createPendingLootFromCharacter } from '@cardgame/items';
import {
  COMBAT_PLAYER_ID,
  CombatSession,
  combatBootstrapConfig,
  isPlayerCombatReady,
  type CombatEncounterEnd,
  type CombatSessionTuneables,
} from '@cardgame/combat';

import type { AdventureSession } from './adventure-session.js';
import { AdventureError } from './errors.js';
import type { RoomGroundLootEntry } from './types.js';

export type AdventureCombatHostConfig = Partial<CombatSessionTuneables> & {
  itemCatalog: Record<string, ItemDefinition>;
  /** Override room encounter characterId (tests / virtual levels). */
  enemyCharacterId?: string;
  /** Player deck for this fight (equipment-augmented). */
  deckIds?: readonly string[];
};

/**
 * After ConfirmCombat: attach CombatSession.
 * Reuses adventure player GFC when present; otherwise creates a fresh player.
 */
export function beginAdventureCombat(
  adventure: AdventureSession,
  engine: RuleEngine,
  config: AdventureCombatHostConfig,
): CombatSession {
  if (adventure.getPhase() !== 'combat') {
    throw new AdventureError('beginAdventureCombat requires adventure phase combat');
  }

  const room = adventure.getCurrentRoom();
  const characterId = config.enemyCharacterId ?? room.encounter?.characterId;
  if (!characterId) {
    throw new AdventureError('No encounter characterId on current room');
  }

  const reusePlayer = (() => {
    const player = engine.getGfc(COMBAT_PLAYER_ID);
    return player !== undefined && isPlayerCombatReady(player);
  })();
  const session = CombatSession.attach(
    engine,
    combatBootstrapConfig(engine, {
      ...config,
      enemyCharacterId: characterId,
    }),
    { reusePlayer },
  );
  adventure.notifyCombatAttached();
  return session;
}

export type FinishAdventureCombatOptions = {
  itemCatalog: Record<string, ItemDefinition>;
  lootRng?: () => number;
};

/** Detach combat, place victory loot on room ground, restore explore (or defeat). */
export function finishAdventureCombat(
  adventure: AdventureSession,
  session: CombatSession,
  options: FinishAdventureCombatOptions,
): CombatEncounterEnd {
  const enemy = session.getEnemyCharacterInstance();
  const end = session.detach();

  if (end.result === 'victory') {
    const pending = createPendingLootFromCharacter(
      {
        loadout: enemy.loadout,
        inventory: enemy.inventory,
        lootEntries: enemy.loot.entries,
      },
      options.itemCatalog,
      options.lootRng ?? (() => 0),
    );
    const loot: RoomGroundLootEntry[] = pending.entries.map((entry) => ({
      itemId: entry.itemId,
      quantity: entry.quantity,
    }));
    adventure.resolveCombatVictory(loot);
  } else {
    adventure.resolveCombatDefeat();
  }

  return end;
}
