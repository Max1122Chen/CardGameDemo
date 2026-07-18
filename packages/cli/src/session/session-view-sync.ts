import type { CombatSnapshot } from '@cardgame/combat';
import { resolveRepoDataRoot } from '@cardgame/combat';
import type { AdventureSession, AdventureSnapshot } from '@cardgame/dungeon';
import {
  createPendingLootFromCharacter,
  createPendingLootFromTable,
  listEquipmentSlots,
  listInventorySlots,
  listPendingLoot,
  loadBattleRewards,
  renderInventoryGrid,
  type ItemDefinition,
} from '@cardgame/items';

import { renderLevelMapLines } from '../render/explore-map.js';
import type {
  AppState,
  EntityStatsView,
  GameSessionPhase,
  PrimaryStatsView,
  RoomLootView,
} from '../types.js';
import { clampIndex } from './clamp.js';
import type { SessionController } from './session-types.js';

export function toPrimaryStatsView(
  primaries: NonNullable<CombatSnapshot['player']['primaries']>,
): PrimaryStatsView {
  return {
    strength: primaries.Strength,
    constitution: primaries.Constitution,
    dexterity: primaries.Dexterity,
    intelligence: primaries.Intelligence,
    wisdom: primaries.Wisdom,
    charisma: primaries.Charisma,
  };
}

export function toEntityStatsView(actor: CombatSnapshot['player']): EntityStatsView | undefined {
  if (!actor.primaries) {
    return undefined;
  }
  return {
    health: actor.health,
    maxHealth: actor.maxHealth,
    block: actor.block,
    actionPoints: actor.actionPoints,
    maxActionPoints: actor.maxActionPoints,
    primaries: toPrimaryStatsView(actor.primaries),
    damageScaling: actor.damageScaling,
    damageMultiplier: actor.damageMultiplier,
    damageOffset: actor.damageOffset,
  };
}

export function nextInventoryFocus(
  current: AppState['inventoryFocus'],
  hasLoot: boolean,
): AppState['inventoryFocus'] {
  if (hasLoot) {
    if (current === 'loot') {
      return 'backpack';
    }
    if (current === 'backpack') {
      return 'equipment';
    }
    return 'loot';
  }
  return current === 'backpack' ? 'equipment' : 'backpack';
}

export function syncInventoryViews(
  state: AppState,
  controller: SessionController,
): Pick<
  AppState,
  | 'inventoryWidth'
  | 'inventoryHeight'
  | 'inventorySlots'
  | 'inventoryGrid'
  | 'pendingLoot'
  | 'equipmentSlots'
  | 'selectedLootIndex'
  | 'selectedInventorySlot'
  | 'selectedEquipmentSlot'
  | 'inventoryFocus'
> {
  const inventorySlots = listInventorySlots(controller.inventory, controller.itemCatalog);
  const pendingLoot = listPendingLoot(controller.pendingLoot, controller.itemCatalog);
  const equipmentSlots = listEquipmentSlots(controller.loadout, controller.itemCatalog);
  const selectedSlot = inventorySlots[clampIndex(state.selectedInventorySlot, inventorySlots.length)];
  const inventoryGrid = renderInventoryGrid(
    controller.inventory,
    controller.itemCatalog,
    selectedSlot?.entryId,
  );

  let inventoryFocus = state.inventoryFocus;
  if (pendingLoot.length === 0 && inventoryFocus === 'loot') {
    inventoryFocus = 'backpack';
  }

  return {
    inventoryWidth: controller.inventory.width,
    inventoryHeight: controller.inventory.height,
    inventorySlots,
    inventoryGrid,
    pendingLoot,
    equipmentSlots,
    inventoryFocus,
    selectedLootIndex: clampIndex(state.selectedLootIndex, pendingLoot.length),
    selectedInventorySlot: clampIndex(state.selectedInventorySlot, inventorySlots.length),
    selectedEquipmentSlot: clampIndex(state.selectedEquipmentSlot, equipmentSlots.length),
  };
}

export function maybeSpawnVictoryLoot(controller: SessionController, snapshot: CombatSnapshot): string | undefined {
  if (controller.sessionKind === 'adventure') {
    return undefined;
  }
  if (snapshot.result !== 'victory' || controller.lootSpawned) {
    return undefined;
  }

  const enemy = controller.combatSession!.getEnemyCharacterInstance();
  const characterLoot = createPendingLootFromCharacter(
    {
      loadout: enemy.loadout,
      inventory: enemy.inventory,
      lootEntries: enemy.loot.entries,
    },
    controller.itemCatalog,
    () => 0,
  );

  if (characterLoot.entries.length > 0) {
    controller.pendingLoot = characterLoot;
  } else {
    const dataRoot = resolveRepoDataRoot();
    const rewards = loadBattleRewards(dataRoot);
    controller.pendingLoot = createPendingLootFromTable(rewards);
  }

  controller.lootSpawned = true;
  return 'Victory! Select loot with 1-9. P pickup | A all | B bag. Then console: battle [slime|orc_brute]';
}

export function roomLootViews(
  adventure: AdventureSession,
  catalog: Record<string, ItemDefinition>,
): RoomLootView[] {
  const loot = adventure.getRoomState(adventure.getCurrentRoomId()).loot;
  return loot.map((entry, index) => {
    const def = catalog[entry.itemId];
    const name = def?.name ?? entry.itemId;
    return {
      index,
      itemId: entry.itemId,
      name,
      quantity: entry.quantity,
      label: `${name} x${entry.quantity}`,
    };
  });
}

export function adventurePhaseToSessionPhase(phase: AdventureSnapshot['phase']): GameSessionPhase {
  switch (phase) {
    case 'explore':
      return 'adventure_explore';
    case 'combat':
      return 'adventure_combat';
    case 'victory':
      return 'adventure_victory';
    case 'defeat':
      return 'adventure_defeat';
  }
}

export function syncAdventureExploreViews(
  state: AppState,
  controller: SessionController,
): AppState {
  const adventure = controller.adventure!;
  const snap = adventure.getSnapshot();
  const roomLoot = roomLootViews(adventure, controller.itemCatalog);
  const inventoryViews = syncInventoryViews(state, controller);
  const playerGfc = controller.engine.getGfc('player');
  const health = playerGfc?.getAttribute('Health')?.currentValue;
  const maxHealth = playerGfc?.getAttribute('MaxHealth')?.currentValue;
  const block = playerGfc?.getAttribute('Block')?.currentValue ?? 0;

  let statusMessage = state.statusMessage;
  if (snap.activeInteraction) {
    statusMessage = `${snap.activeInteraction.displayName} — 1-${snap.activeInteraction.frame.options.length} choose | X cancel`;
  } else if (snap.phase === 'victory') {
    statusMessage =
      snap.levelCount > 1 ? 'Evacuated — dungeon cleared!' : 'Level cleared!';
  } else if (snap.phase === 'defeat') {
    statusMessage = 'Defeat — adventure ended.';
  } else if (snap.pendingCombat) {
    // Do not clobber fresher action feedback (Moved / Cannot… / Nothing to interact…).
    const stickyDefault =
      !statusMessage ||
      statusMessage.startsWith('Enemy in ') ||
      statusMessage.startsWith('WASD') ||
      statusMessage.startsWith('Dungeon ');
    if (stickyDefault) {
      statusMessage = `Enemy in ${snap.currentRoomId} — Enter/C to fight`;
    }
  }

  const active = snap.activeInteraction;
  return {
    ...state,
    ...inventoryViews,
    sessionPhase: adventurePhaseToSessionPhase(snap.phase),
    levelId: snap.levelId,
    levelIndex: snap.levelIndex,
    levelCount: snap.levelCount,
    currentRoomId: snap.currentRoomId,
    position: snap.position,
    exploreRound: snap.round,
    exploreAp: snap.exploreAp,
    maxExploreAp: snap.maxExploreAp,
    pendingCombat: snap.pendingCombat,
    mapLines: renderLevelMapLines(adventure.getLevel(), snap),
    roomLoot,
    selectedRoomLootIndex: clampIndex(state.selectedRoomLootIndex, roomLoot.length),
    adventureLog: [...snap.log].slice(-12),
    combatLog: [...snap.log].slice(-12),
    interactPickMode: active ? false : state.interactPickMode,
    interactionPrompt: active?.frame.prompt,
    interactionOptions: active?.frame.options,
    roomInteractables: snap.roomInteractables.map((item) => ({
      id: item.id,
      displayName: item.displayName,
      kind: item.kind,
    })),
    hand: [],
    enemies: [],
    combatResult: undefined,
    combatPhase: snap.phase,
    turnOwner: 'player',
    previewActive: false,
    preview: undefined,
    playerHealth: health ?? state.playerHealth,
    playerBlock: block,
    actionPoints: snap.exploreAp,
    playerStats: playerGfc
      ? {
          health: health ?? 0,
          maxHealth: maxHealth ?? health ?? 0,
          block,
          actionPoints: snap.exploreAp,
          maxActionPoints: snap.maxExploreAp,
          primaries: {
            strength: playerGfc.getAttribute('Strength')?.currentValue ?? 10,
            constitution: playerGfc.getAttribute('Constitution')?.currentValue ?? 10,
            dexterity: playerGfc.getAttribute('Dexterity')?.currentValue ?? 10,
            intelligence: playerGfc.getAttribute('Intelligence')?.currentValue ?? 10,
            wisdom: playerGfc.getAttribute('Wisdom')?.currentValue ?? 10,
            charisma: playerGfc.getAttribute('Charisma')?.currentValue ?? 10,
          },
        }
      : state.playerStats,
    statusMessage,
  };
}

