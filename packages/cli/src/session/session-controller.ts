import { CombatSession, resolveRepoDataRoot, type CombatSnapshot } from '@cardgame/combat';
import {
  RuleEngine,
  TraceBuffer,
} from '@cardgame/core';
import {
  AdventureSession,
  activateDungeonMove,
  beginAdventureCombat,
  createVirtualBattleLevel,
  ensureExplorePlayerForMove,
  finishAdventureCombat,
  loadLevelFromRepo,
  registerDungeonAbilityHandlers,
  type AdventureSnapshot,
} from '@cardgame/dungeon';
import {
  addToInventory,
  buildDeckIdsFromLoadout,
  createEquipmentLoadout,
  createInventory,
  createPendingLootFromCharacter,
  createPendingLootFromTable,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  discardInventoryEntry,
  equipFromInventory,
  listEquipmentSlots,
  listInventorySlots,
  listPendingLoot,
  loadBattleRewards,
  moveInventoryEntry,
  pickupAllLoot,
  pickupLootEntry,
  placePendingLootEntry,
  renderInventoryGrid,
  tidyInventory,
  unequipToInventory,
  type EquipmentLoadout,
  type InventoryState,
  type ItemDefinition,
  type PendingLootState,
  type Rotation,
} from '@cardgame/items';

import { combatBootstrapConfig, loadDeckIds, resolveRepoDataRoot as resolveCliDataRoot } from '../data/load-combat-bootstrap.js';
import { loadItemBootstrap, loadItemTagDefinitions } from '../data/load-items-bootstrap.js';

import { executeConsoleCommand } from '../console/console-executor.js';
import { applyOverlayToggle } from '../input/input-router.js';
import { renderLevelMapLines } from '../render/explore-map.js';
import type {
  AppState,
  CombatPreviewView,
  EnemyView,
  EntityStatsView,
  GameSessionPhase,
  HandCard,
  PrimaryStatsView,
  RoomLootView,
  UiAction,
} from '../types.js';
import { isAdventureCombatPhase, isExplorePhase } from '../ui-mode.js';
function toPrimaryStatsView(
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

function toEntityStatsView(actor: CombatSnapshot['player']): EntityStatsView | undefined {
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

function nextInventoryFocus(
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

function syncInventoryViews(
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

function maybeSpawnVictoryLoot(controller: SessionController, snapshot: CombatSnapshot): string | undefined {
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

function roomLootViews(
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

function adventurePhaseToSessionPhase(phase: AdventureSnapshot['phase']): GameSessionPhase {
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

function syncAdventureExploreViews(
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
  const ap = playerGfc?.getAttribute('ActionPoints')?.currentValue ?? 0;

  let statusMessage = state.statusMessage;
  if (snap.pendingCombat) {
    statusMessage = `Enemy in ${snap.currentRoomId} — Enter/C to fight`;
  } else if (snap.phase === 'victory') {
    statusMessage = 'Level cleared!';
  } else if (snap.phase === 'defeat') {
    statusMessage = 'Defeat — adventure ended.';
  }

  return {
    ...state,
    ...inventoryViews,
    sessionPhase: adventurePhaseToSessionPhase(snap.phase),
    levelId: snap.levelId,
    currentRoomId: snap.currentRoomId,
    pendingCombat: snap.pendingCombat,
    mapLines: renderLevelMapLines(adventure.getLevel(), snap),
    roomLoot,
    selectedRoomLootIndex: clampIndex(state.selectedRoomLootIndex, roomLoot.length),
    adventureLog: [...snap.log].slice(-12),
    combatLog: [...snap.log].slice(-12),
    hand: [],
    enemies: [],
    combatResult: undefined,
    combatPhase: snap.phase,
    turnOwner: 'player',
    previewActive: false,
    preview: undefined,
    playerHealth: health ?? state.playerHealth,
    playerBlock: block,
    actionPoints: ap,
    playerStats: playerGfc
      ? {
          health: health ?? 0,
          maxHealth: maxHealth ?? health ?? 0,
          block,
          actionPoints: ap,
          maxActionPoints: playerGfc.getAttribute('MaxActionPoints')?.currentValue,
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

export function createSessionController(options: {
  seed?: number;
  scenarioId?: string;
  traceToBuffer?: boolean;
  enemyCharacterId?: string;
  enemyHealthOverride?: number;
  /** Default: standalone combat (unit tests). Use adventure for TUI battle/dungeon. */
  sessionKind?: 'standalone' | 'adventure';
  adventureKind?: 'battle_only' | 'dungeon';
  levelId?: string;
}): SessionController {
  const traceBuffer = options.traceToBuffer ? new TraceBuffer() : undefined;
  const itemTagDefinitions = loadItemTagDefinitions();
  const engine = RuleEngine.create({
    traceSink: traceBuffer,
    tagDefinitions: { json: itemTagDefinitions },
  });

  const itemCatalog = loadItemBootstrap(engine.tagManager);
  const baseDeckIds = loadDeckIds(`${resolveCliDataRoot()}/decks`, 'starter');
  const inventory = createInventory(DEFAULT_GRID_WIDTH, DEFAULT_GRID_HEIGHT);
  const loadout = createEquipmentLoadout();
  let pendingLoot: PendingLootState = { entries: [] };
  let lootSpawned = false;
  let enemyCharacterId = options.enemyCharacterId ?? 'slime';
  const enemyHealthOverride = options.enemyHealthOverride;
  const sessionKind = options.sessionKind ?? 'standalone';

  const startStandaloneCombat = () => {
    const deckIds = buildDeckIdsFromLoadout(baseDeckIds, loadout, itemCatalog);
    return CombatSession.bootstrap(
      engine,
      combatBootstrapConfig(engine, {
        deckIds,
        itemCatalog,
        enemyCharacterId,
        enemyHealthOverride,
      }),
    );
  };

  const startAdventureLevel = (kind: 'battle_only' | 'dungeon', levelId?: string) => {
    const level =
      kind === 'battle_only'
        ? createVirtualBattleLevel(enemyCharacterId)
        : loadLevelFromRepo(levelId ?? 'level.probe');
    return AdventureSession.start(level);
  };

  let adventure: AdventureSession | null =
    sessionKind === 'adventure'
      ? startAdventureLevel(options.adventureKind ?? 'battle_only', options.levelId)
      : null;
  if (adventure) {
    registerDungeonAbilityHandlers(engine.activationRegistry);
  }
  let combatSession: CombatSession | null =
    sessionKind === 'standalone' ? startStandaloneCombat() : null;

  const controller: SessionController = {
    engine,
    combatSession,
    adventure,
    sessionKind,
    itemCatalog,
    inventory,
    loadout,
    baseDeckIds,
    enemyCharacterId,
    pendingLoot,
    lootSpawned,
    traceLines: [],
    bootstrapBattle(nextEnemyId?: string) {
      if (nextEnemyId) {
        enemyCharacterId = nextEnemyId;
        controller.enemyCharacterId = enemyCharacterId;
      }
      pendingLoot = { entries: [] };
      lootSpawned = false;
      controller.pendingLoot = pendingLoot;
      controller.lootSpawned = lootSpawned;

      if (controller.sessionKind === 'adventure') {
        adventure = startAdventureLevel('battle_only');
        controller.adventure = adventure;
        combatSession = null;
        controller.combatSession = null;
        return;
      }

      combatSession = startStandaloneCombat();
      controller.combatSession = combatSession;
    },
    startDungeon(levelId?: string) {
      controller.sessionKind = 'adventure';
      pendingLoot = { entries: [] };
      lootSpawned = false;
      controller.pendingLoot = pendingLoot;
      controller.lootSpawned = lootSpawned;
      adventure = startAdventureLevel('dungeon', levelId);
      controller.adventure = adventure;
      combatSession = null;
      controller.combatSession = null;
    },
    getCombatSnapshot() {
      if (!controller.combatSession) {
        throw new Error('No active combat session');
      }
      return controller.combatSession.getSnapshot();
    },
    syncViewState(state) {
      controller.traceLines = traceBuffer
        ? traceBuffer.entries.map((entry) => JSON.stringify(entry))
        : controller.traceLines;

      if (controller.sessionKind === 'adventure' && controller.adventure) {
        const advPhase = controller.adventure.getPhase();
        if (advPhase !== 'combat' || !controller.combatSession) {
          return syncAdventureExploreViews(state, controller);
        }
      }

      const activeCombat = controller.combatSession;
      if (!activeCombat) {
        return state;
      }

      const snapshot = activeCombat.getSnapshot();
      const lootHint = maybeSpawnVictoryLoot(controller, snapshot);

      if (
        controller.sessionKind === 'adventure' &&
        controller.adventure &&
        snapshot.result !== undefined
      ) {
        finishAdventureCombat(controller.adventure, activeCombat, {
          itemCatalog: controller.itemCatalog,
          lootRng: () => 0,
        });
        controller.combatSession = null;
        combatSession = null;
        return syncAdventureExploreViews(
          {
            ...state,
            statusMessage:
              snapshot.result === 'victory'
                ? 'Victory — loot is on the room floor. P pickup | WASD move'
                : 'Defeat.',
          },
          controller,
        );
      }

      const hand: HandCard[] = snapshot.hand.map((card) => ({
        id: card.actionId,
        name: card.name,
        cost: card.cost,
      }));

      const preview = snapshot.preview;
      const enemies: EnemyView[] = snapshot.enemies.map((enemy) => ({
        id: enemy.entityId,
        name: enemy.name,
        health: enemy.health,
        block: enemy.block,
        intent: snapshot.enemyIntent?.label ?? 'Unknown',
        previewDamageToTake:
          preview && preview.targetEntityId === enemy.entityId ? preview.damageToTake : undefined,
      }));

      const combatLog = snapshot.combatLog.length > 0 ? snapshot.combatLog : state.combatLog;

      const previewView: CombatPreviewView | undefined = preview
        ? {
            handIndex: preview.handIndex,
            actionId: preview.actionId,
            targetEntityId: preview.targetEntityId,
            damage: preview.damage,
            damageToTake: preview.damageToTake,
            blockToGain: preview.blockToGain,
            damageBreakdown: preview.damageBreakdown,
          }
        : undefined;

      const inventoryViews = syncInventoryViews(state, controller);
      const sessionPhase: GameSessionPhase =
        controller.sessionKind === 'adventure' ? 'adventure_combat' : 'standalone_combat';

      return {
        ...state,
        sessionPhase,
        hand,
        enemies,
        playerHealth: snapshot.player.health,
        playerBlock: snapshot.player.block,
        actionPoints: snapshot.player.actionPoints ?? 0,
        combatPhase: snapshot.phase,
        turnOwner: snapshot.turnOwner,
        combatResult: snapshot.result,
        combatLog,
        selectedHandIndex: Math.min(state.selectedHandIndex, Math.max(0, hand.length - 1)),
        selectedEnemyIndex: Math.min(state.selectedEnemyIndex, Math.max(0, enemies.length - 1)),
        previewActive: previewView !== undefined,
        preview: previewView,
        playerStats: toEntityStatsView(snapshot.player),
        enemyStats: (() => {
          const selected =
            snapshot.enemies[
              Math.min(state.selectedEnemyIndex, Math.max(0, snapshot.enemies.length - 1))
            ] ?? snapshot.enemies[0];
          return selected ? toEntityStatsView(selected) : undefined;
        })(),
        ...inventoryViews,
        statusMessage: lootHint ?? state.statusMessage,
        mapLines: [],
        roomLoot: [],
        pendingCombat: false,
      };
    },
  };

  return controller;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return ((index % length) + length) % length;
}

function pushLog(state: AppState, line: string): AppState {
  const combatLog = [...state.combatLog, line];
  if (combatLog.length > 8) {
    combatLog.shift();
  }
  return { ...state, combatLog, statusMessage: line };
}

function isCombatInteractive(state: AppState): boolean {
  if (isExplorePhase(state) || state.sessionPhase === 'adventure_victory' || state.sessionPhase === 'adventure_defeat') {
    return false;
  }
  return state.combatPhase === 'PlayerTurn' && !state.combatResult;
}

function canModifyLoadout(state: AppState): boolean {
  if (isAdventureCombatPhase(state)) {
    return false;
  }
  if (state.sessionPhase === 'standalone_combat') {
    return state.combatResult !== undefined;
  }
  return true;
}

function previewStatusMessage(state: AppState): string {
  const preview = state.preview;
  if (!preview) {
    return state.statusMessage;
  }
  const card = state.hand[preview.handIndex];
  const name = card?.name ?? preview.actionId;
  if (preview.blockToGain !== undefined && preview.blockToGain > 0) {
    return `${name} preview: Block +${preview.blockToGain} (Space commit, Esc/x cancel)`;
  }
  if (preview.damageToTake !== undefined) {
    const breakdown = preview.damageBreakdown;
    const breakdownText = breakdown
      ? ` [${breakdown.panel}${breakdown.bonus >= 0 ? '+' : ''}${breakdown.bonus} ×${breakdown.scaling} ×${breakdown.multiplier} +${breakdown.offset} → ${breakdown.outgoing}]`
      : '';
    return `${name} preview: deal ${preview.damage ?? '?'} → absorb ${preview.damageToTake}${breakdownText} (Space commit, Esc/x cancel)`;
  }
  return `${name} preview active (Space commit, Esc/x cancel)`;
}

/** Recompute GFC preview from current UI selection. */
function refreshCardPreview(state: AppState, controller: SessionController): AppState {
  if (!controller.combatSession || !isCombatInteractive(state) || state.hand.length === 0) {
    controller.combatSession?.cancelCardPreview();
    return controller.syncViewState(state);
  }

  const enemy = state.enemies[state.selectedEnemyIndex];
  const targetId = enemy?.id;
  try {
    controller.combatSession.beginCardPreview(state.selectedHandIndex, targetId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed.';
    controller.combatSession.cancelCardPreview();
    return { ...controller.syncViewState(state), statusMessage: message };
  }

  const synced = controller.syncViewState(state);
  return { ...synced, statusMessage: previewStatusMessage(synced) };
}

function parsePlaceCommand(
  input: string,
): { x: number; y: number; rotation: Rotation } | undefined {
  const parts = input.trim().split(/\s+/).filter((part) => part.length > 0);
  if (parts.length < 2 || parts.length > 3) {
    return undefined;
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  const rotationRaw = parts[2] === undefined ? 0 : Number(parts[2]);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return undefined;
  }
  if (rotationRaw !== 0 && rotationRaw !== 90) {
    return undefined;
  }
  return { x, y, rotation: rotationRaw };
}

function placeFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case 'inventory_full':
      return 'Inventory full.';
    case 'out_of_bounds':
      return 'Placement out of bounds.';
    case 'collision':
      return 'Placement collides with another item.';
    case 'invalid_rotation':
      return 'Rotation must be 0 or 90.';
    case 'unknown_item':
      return 'Unknown item.';
    case 'unknown_entry':
      return 'Unknown inventory entry.';
    default:
      return 'Could not place item.';
  }
}

function syncAfterInventoryAction(state: AppState, controller: SessionController, message: string): AppState {
  return { ...controller.syncViewState(state), statusMessage: message };
}

export function applyUiAction(
  state: AppState,
  controller: SessionController,
  action: UiAction,
): AppState {
  switch (action.type) {
    case 'toggle_inventory':
      return applyOverlayToggle(state, 'inventory');
    case 'toggle_settings':
      return applyOverlayToggle(state, 'settings');
    case 'toggle_console':
      return applyOverlayToggle(state, 'console');
    case 'close_overlay':
      return {
        ...state,
        overlay: 'none',
        focusLayer: 'gameplay',
      };
    case 'close_stats_overlay':
      return { ...state, statsOverlay: 'none' };
    case 'toggle_player_stats':
      return {
        ...state,
        statsOverlay: state.statsOverlay === 'player' ? 'none' : 'player',
      };
    case 'toggle_enemy_stats':
      return {
        ...state,
        statsOverlay: state.statsOverlay === 'enemy' ? 'none' : 'enemy',
      };
    case 'toggle_trace_pane':
      return { ...state, showTracePane: !state.showTracePane };
    case 'quit':
      return { ...state, shouldQuit: true };
    case 'inventory_prev': {
      if (state.inventoryFocus === 'loot' && state.pendingLoot.length > 0) {
        return syncAfterInventoryAction(
          {
            ...state,
            selectedLootIndex: clampIndex(state.selectedLootIndex - 1, state.pendingLoot.length),
          },
          controller,
          state.statusMessage,
        );
      }
      if (state.inventoryFocus === 'equipment') {
        return syncAfterInventoryAction(
          {
            ...state,
            selectedEquipmentSlot: clampIndex(
              state.selectedEquipmentSlot - 1,
              state.equipmentSlots.length,
            ),
          },
          controller,
          state.statusMessage,
        );
      }
      return syncAfterInventoryAction(
        {
          ...state,
          selectedInventorySlot: clampIndex(state.selectedInventorySlot - 1, state.inventorySlots.length),
        },
        controller,
        state.statusMessage,
      );
    }
    case 'inventory_next': {
      if (state.inventoryFocus === 'loot' && state.pendingLoot.length > 0) {
        return syncAfterInventoryAction(
          {
            ...state,
            selectedLootIndex: clampIndex(state.selectedLootIndex + 1, state.pendingLoot.length),
          },
          controller,
          state.statusMessage,
        );
      }
      if (state.inventoryFocus === 'equipment') {
        return syncAfterInventoryAction(
          {
            ...state,
            selectedEquipmentSlot: clampIndex(
              state.selectedEquipmentSlot + 1,
              state.equipmentSlots.length,
            ),
          },
          controller,
          state.statusMessage,
        );
      }
      return syncAfterInventoryAction(
        {
          ...state,
          selectedInventorySlot: clampIndex(state.selectedInventorySlot + 1, state.inventorySlots.length),
        },
        controller,
        state.statusMessage,
      );
    }
    case 'inventory_toggle_focus': {
      return syncAfterInventoryAction(
        {
          ...state,
          inventoryFocus: nextInventoryFocus(state.inventoryFocus, state.pendingLoot.length > 0),
          inventoryPlaceInput: '',
        },
        controller,
        state.statusMessage,
      );
    }
    case 'pickup_selected_loot': {
      if (state.pendingLoot.length === 0) {
        return syncAfterInventoryAction(state, controller, 'No loot to pickup.');
      }
      const entry = state.pendingLoot[state.selectedLootIndex];
      if (!entry) {
        return syncAfterInventoryAction(state, controller, 'No loot selected.');
      }
      const result = pickupLootEntry(
        controller.pendingLoot,
        controller.inventory,
        controller.itemCatalog,
        entry.lootIndex,
      );
      if (!result.ok) {
        const reason =
          result.reason === 'inventory_full'
            ? 'Inventory full.'
            : result.reason === 'unknown_item'
              ? 'Unknown item.'
              : 'Could not pickup loot.';
        return syncAfterInventoryAction(state, controller, reason);
      }
      return syncAfterInventoryAction(state, controller, `Picked up ${entry.label}.`);
    }
    case 'pickup_all_loot': {
      if (state.pendingLoot.length === 0) {
        return syncAfterInventoryAction(state, controller, 'No loot to pickup.');
      }
      const result = pickupAllLoot(controller.pendingLoot, controller.inventory, controller.itemCatalog);
      if (result.pickedEntries === 0) {
        return syncAfterInventoryAction(state, controller, 'Inventory full — could not pickup loot.');
      }
      const suffix = result.partial ? ' (inventory full, some loot remains)' : '';
      return syncAfterInventoryAction(state, controller, `Picked up loot${suffix}.`);
    }
    case 'discard_selected_inventory_slot': {
      const slot = state.inventorySlots[state.selectedInventorySlot];
      if (!slot) {
        return syncAfterInventoryAction(state, controller, 'No inventory slot selected.');
      }
      if (!discardInventoryEntry(controller.inventory, slot.entryId)) {
        return syncAfterInventoryAction(state, controller, 'Could not discard item.');
      }
      return syncAfterInventoryAction(
        { ...state, inventoryPlaceInput: '' },
        controller,
        `Discarded ${slot.label}.`,
      );
    }
    case 'tidy_inventory': {
      const result = tidyInventory(controller.inventory, controller.itemCatalog);
      if (!result.ok) {
        return syncAfterInventoryAction(state, controller, 'Tidy failed — restored previous layout.');
      }
      return syncAfterInventoryAction(state, controller, 'Backpack tidied.');
    }
    case 'equip_selected_item': {
      if (!canModifyLoadout(state)) {
        return syncAfterInventoryAction(
          state,
          controller,
          'Equip only outside active combat. Finish the fight or use explore phase.',
        );
      }
      const slot = state.inventorySlots[state.selectedInventorySlot];
      if (!slot) {
        return syncAfterInventoryAction(state, controller, 'No backpack item selected.');
      }
      const result = equipFromInventory(
        controller.loadout,
        controller.inventory,
        controller.itemCatalog,
        slot.entryId,
      );
      if (!result.ok) {
        const reason =
          result.reason === 'not_equipment'
            ? 'Not equipment.'
            : result.reason === 'no_free_slot'
              ? 'No free compatible slot.'
              : result.reason === 'hands_busy'
                ? 'Both hands required but busy.'
                : result.reason === 'not_instance'
                  ? 'Cannot equip stacks.'
                  : 'Could not equip.';
        return syncAfterInventoryAction(state, controller, reason);
      }
      return syncAfterInventoryAction(
        { ...state, inventoryFocus: 'equipment' },
        controller,
        `Equipped ${slot.name}. Deck updates on next battle.`,
      );
    }
    case 'unequip_selected_slot': {
      if (!canModifyLoadout(state)) {
        return syncAfterInventoryAction(
          state,
          controller,
          'Unequip only outside active combat.',
        );
      }
      const equipment = state.equipmentSlots[state.selectedEquipmentSlot];
      if (!equipment?.entryId) {
        return syncAfterInventoryAction(state, controller, 'No equipped item in selected slot.');
      }
      const result = unequipToInventory(
        controller.loadout,
        controller.inventory,
        controller.itemCatalog,
        equipment.entryId,
      );
      if (!result.ok) {
        const reason =
          result.reason === 'inventory_full' ? 'Backpack full — cannot unequip.' : 'Could not unequip.';
        return syncAfterInventoryAction(state, controller, reason);
      }
      return syncAfterInventoryAction(
        { ...state, inventoryFocus: 'backpack' },
        controller,
        `Unequipped ${equipment.name ?? equipment.slotId}. Deck updates on next battle.`,
      );
    }
    case 'inventory_place_append':
      return { ...state, inventoryPlaceInput: `${state.inventoryPlaceInput}${action.char}` };
    case 'inventory_place_backspace':
      return { ...state, inventoryPlaceInput: state.inventoryPlaceInput.slice(0, -1) };
    case 'inventory_place_submit': {
      const parsed = parsePlaceCommand(state.inventoryPlaceInput);
      if (!parsed) {
        return syncAfterInventoryAction(
          { ...state, inventoryPlaceInput: '' },
          controller,
          'Place format: x y [0|90]  (origin top-left).',
        );
      }

      if (state.inventoryFocus === 'loot' && state.pendingLoot.length > 0) {
        const loot = state.pendingLoot[state.selectedLootIndex];
        if (!loot) {
          return syncAfterInventoryAction(
            { ...state, inventoryPlaceInput: '' },
            controller,
            'No loot selected.',
          );
        }
        const result = placePendingLootEntry(
          controller.pendingLoot,
          controller.inventory,
          controller.itemCatalog,
          loot.lootIndex,
          parsed.x,
          parsed.y,
          parsed.rotation,
        );
        if (!result.ok) {
          return syncAfterInventoryAction(
            { ...state, inventoryPlaceInput: '' },
            controller,
            placeFailureMessage(result.reason),
          );
        }
        return syncAfterInventoryAction(
          { ...state, inventoryPlaceInput: '' },
          controller,
          `Placed ${loot.label} at (${parsed.x},${parsed.y}) rot ${parsed.rotation}.`,
        );
      }

      const slot = state.inventorySlots[state.selectedInventorySlot];
      if (!slot) {
        return syncAfterInventoryAction(
          { ...state, inventoryPlaceInput: '' },
          controller,
          'No backpack item selected.',
        );
      }
      const moveResult = moveInventoryEntry(
        controller.inventory,
        controller.itemCatalog,
        slot.entryId,
        parsed.x,
        parsed.y,
        parsed.rotation,
      );
      if (!moveResult.ok) {
        return syncAfterInventoryAction(
          { ...state, inventoryPlaceInput: '' },
          controller,
          placeFailureMessage(moveResult.reason),
        );
      }
      return syncAfterInventoryAction(
        { ...state, inventoryPlaceInput: '' },
        controller,
        `Moved ${slot.label} to (${parsed.x},${parsed.y}) rot ${parsed.rotation}.`,
      );
    }
    case 'hand_prev': {
      if (isExplorePhase(state)) {
        if (state.roomLoot.length === 0) {
          return state;
        }
        return {
          ...state,
          selectedRoomLootIndex: clampIndex(state.selectedRoomLootIndex - 1, state.roomLoot.length),
        };
      }
      if (state.combatResult === 'victory') {
        if (state.pendingLoot.length === 0) {
          return state;
        }
        return {
          ...state,
          selectedLootIndex: clampIndex(state.selectedLootIndex - 1, state.pendingLoot.length),
          inventoryFocus: 'loot',
        };
      }
      const next = {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex - 1, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'hand_next': {
      if (isExplorePhase(state)) {
        if (state.roomLoot.length === 0) {
          return state;
        }
        return {
          ...state,
          selectedRoomLootIndex: clampIndex(state.selectedRoomLootIndex + 1, state.roomLoot.length),
        };
      }
      if (state.combatResult === 'victory') {
        if (state.pendingLoot.length === 0) {
          return state;
        }
        return {
          ...state,
          selectedLootIndex: clampIndex(state.selectedLootIndex + 1, state.pendingLoot.length),
          inventoryFocus: 'loot',
        };
      }
      const next = {
        ...state,
        selectedHandIndex: clampIndex(state.selectedHandIndex + 1, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'enemy_prev': {
      const next = {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex - 1, state.enemies.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'enemy_next': {
      const next = {
        ...state,
        selectedEnemyIndex: clampIndex(state.selectedEnemyIndex + 1, state.enemies.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'select_hand': {
      if (state.combatResult === 'victory') {
        if (state.pendingLoot.length === 0) {
          return state;
        }
        return {
          ...state,
          selectedLootIndex: clampIndex(action.index, state.pendingLoot.length),
          inventoryFocus: 'loot',
        };
      }
      const next = {
        ...state,
        selectedHandIndex: clampIndex(action.index, state.hand.length),
      };
      return refreshCardPreview(next, controller);
    }
    case 'cancel_card_preview': {
      if (!controller.combatSession || !isCombatInteractive(state)) {
        return state;
      }
      controller.combatSession.cancelCardPreview();
      const synced = controller.syncViewState(state);
      return { ...synced, statusMessage: 'Card preview cancelled.' };
    }
    case 'play_selected_card': {
      if (!controller.combatSession || !isCombatInteractive(state)) {
        return pushLog(state, state.combatResult ? `Combat ended: ${state.combatResult}.` : 'Not your turn.');
      }

      const card = state.hand[state.selectedHandIndex];
      if (!card) {
        return pushLog(state, 'No card selected.');
      }

      const legal = controller.combatSession.legalActions();
      const canPlay = legal.some(
        (candidate) => candidate.type === 'PlayCard' && candidate.handIndex === state.selectedHandIndex,
      );
      if (!canPlay) {
        return pushLog(state, `Cannot play ${card.name}.`);
      }

      try {
        const enemy = state.enemies[state.selectedEnemyIndex];
        controller.combatSession.beginCardPreview(state.selectedHandIndex, enemy?.id);
        controller.combatSession.applyAction({
          type: 'PlayCard',
          handIndex: state.selectedHandIndex,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to play card.';
        return pushLog(state, message);
      }

      const synced = controller.syncViewState(state);
      const latestLog = synced.combatLog[synced.combatLog.length - 1] ?? `Played ${card.name}.`;
      return refreshCardPreview({ ...synced, statusMessage: latestLog }, controller);
    }
    case 'end_turn': {
      if (!controller.combatSession || !isCombatInteractive(state)) {
        return pushLog(state, state.combatResult ? `Combat ended: ${state.combatResult}.` : 'Not your turn.');
      }

      try {
        controller.combatSession.applyAction({ type: 'EndTurn' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to end turn.';
        return pushLog(state, message);
      }

      const synced = controller.syncViewState(state);
      const latestLog = synced.combatLog[synced.combatLog.length - 1] ?? 'Ended turn.';
      return refreshCardPreview({ ...synced, statusMessage: latestLog }, controller);
    }
    case 'explore_move': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      try {
        const player = ensureExplorePlayerForMove(controller.engine);
        activateDungeonMove({
          engine: controller.engine,
          player,
          adventure: controller.adventure,
          direction: action.direction,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot move.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
      return controller.syncViewState({
        ...state,
        statusMessage: `Moved ${action.direction}.`,
      });
    }
    case 'confirm_combat': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      const legal = controller.adventure.legalActions();
      const canConfirm = legal.some((a) => a.type === 'ConfirmCombat');
      const canLeave = legal.some((a) => a.type === 'LeaveLevel');
      try {
        if (canConfirm) {
          controller.adventure.applyAction({ type: 'ConfirmCombat' });
          const deckIds = buildDeckIdsFromLoadout(
            controller.baseDeckIds,
            controller.loadout,
            controller.itemCatalog,
          );
          const session = beginAdventureCombat(controller.adventure, controller.engine, {
            itemCatalog: controller.itemCatalog,
            deckIds,
            enemyHealthOverride: undefined,
          });
          controller.combatSession = session;
          return controller.syncViewState({
            ...state,
            sessionPhase: 'adventure_combat',
            statusMessage: 'Combat started!',
          });
        }
        if (canLeave) {
          controller.adventure.applyAction({ type: 'LeaveLevel' });
          return controller.syncViewState({
            ...state,
            statusMessage: 'Left the level.',
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot confirm.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
      return { ...controller.syncViewState(state), statusMessage: 'Nothing to confirm.' };
    }
    case 'leave_level': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      try {
        controller.adventure.applyAction({ type: 'LeaveLevel' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot leave.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
      return controller.syncViewState({ ...state, statusMessage: 'Left the level.' });
    }
    case 'select_room_loot': {
      if (!isExplorePhase(state) || state.roomLoot.length === 0) {
        return state;
      }
      return {
        ...state,
        selectedRoomLootIndex: clampIndex(action.index, state.roomLoot.length),
      };
    }
    case 'pickup_room_loot': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      if (state.roomLoot.length === 0) {
        return { ...controller.syncViewState(state), statusMessage: 'No room loot.' };
      }
      const index = state.selectedRoomLootIndex;
      try {
        const entry = controller.adventure.takeLoot(index);
        const add = addToInventory(
          controller.inventory,
          controller.itemCatalog,
          entry.itemId,
          entry.quantity,
        );
        if (!add.ok && add.added === 0) {
          // Put loot back if inventory rejected everything.
          const room = controller.adventure.getRoomState(controller.adventure.getCurrentRoomId());
          room.loot.splice(index, 0, entry);
          return {
            ...controller.syncViewState(state),
            statusMessage: 'Inventory full — could not pick up.',
          };
        }
        return controller.syncViewState({
          ...state,
          statusMessage: `Picked up ${entry.itemId} x${entry.quantity}.`,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Pickup failed.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
    }
    case 'console_append':
      return { ...state, consoleInput: `${state.consoleInput}${action.char}` };
    case 'console_backspace':
      return { ...state, consoleInput: state.consoleInput.slice(0, -1) };
    case 'console_submit': {
      const input = state.consoleInput.trim();
      if (!input) {
        return state;
      }

      const result = executeConsoleCommand(controller, input);
      const consoleScrollback = [...state.consoleScrollback, `> ${input}`, ...result.lines];
      while (consoleScrollback.length > 20) {
        consoleScrollback.shift();
      }

      return {
        ...controller.syncViewState(state),
        consoleInput: '',
        consoleScrollback,
        statusMessage: result.statusMessage,
      };
    }
    default:
      return state;
  }
}

export function applyUiActions(
  state: AppState,
  controller: SessionController,
  actions: readonly UiAction[],
): AppState {
  return actions.reduce((next, action) => applyUiAction(next, controller, action), state);
}
