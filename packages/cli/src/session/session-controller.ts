import {
  CombatSession,
  combatBootstrapConfig,
  loadDeckIds,
  resolveRepoDataRoot,
} from '@cardgame/combat';
import {
  RuleEngine,
  TraceBuffer,
} from '@cardgame/core';
import {
  AdventureSession,
  createSeededRng,
  createVirtualBattleLevel,
  defaultProbeInteractables,
  finishAdventureCombat,
  loadLevelFromRepo,
  registerDungeonAbilityHandlers,
} from '@cardgame/dungeon';
import {
  buildDeckIdsFromLoadout,
  createEquipmentLoadout,
  createInventory,
  addToInventory,
  DEFAULT_GRID_HEIGHT,
  DEFAULT_GRID_WIDTH,
  type PendingLootState,
} from '@cardgame/items';

import { loadItemBootstrap, loadItemTagDefinitions } from '../data/load-items-bootstrap.js';
import type {
  CombatPreviewView,
  EnemyView,
  GameSessionPhase,
  HandCard,
} from '../types.js';
import {
  createSessionInteractionHost,
  ensureExplorePlayerEntity,
} from './interaction-host.js';
import {
  maybeSpawnVictoryLoot,
  syncAdventureExploreViews,
  syncInventoryViews,
  toEntityStatsView,
} from './session-view-sync.js';
import type { SessionController } from './session-types.js';

export type { SessionController } from './session-types.js';
export { applyUiAction, applyUiActions } from './apply-ui-action.js';

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
  const baseDeckIds = loadDeckIds(`${resolveRepoDataRoot()}/decks`, 'starter');
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

  const adventureSeed = options.seed ?? 42;
  const interactRng = createSeededRng(adventureSeed ^ 0x1a2b3c4d);

  const bindInteractionHost = (session: AdventureSession) => {
    ensureExplorePlayerEntity(engine);
    session.setInteractionHost(
      createSessionInteractionHost(
        engine,
        inventory,
        (line) => {
          // Host log lines are also pushed by Interactables via session apply; keep silent here
          // unless we need side-channel status (F01: adventure log already captures begin/end).
          void line;
        },
        {
          itemCatalog,
          nextRandom: interactRng,
        },
      ),
    );
  };

  const startAdventureLevel = (kind: 'battle_only' | 'dungeon', levelId?: string) => {
    if (kind === 'battle_only') {
      const session = AdventureSession.startFromLevel(createVirtualBattleLevel(enemyCharacterId));
      bindInteractionHost(session);
      return session;
    }
    if (levelId) {
      const interactables =
        levelId === 'level.probe' ? defaultProbeInteractables() : undefined;
      const session = AdventureSession.startFromLevel(loadLevelFromRepo(levelId), {
        interactablesByRoom: interactables,
      });
      bindInteractionHost(session);
      if (interactables) {
        addToInventory(inventory, itemCatalog, 'gold_coin', 3);
        addToInventory(inventory, itemCatalog, 'scrap_metal', 2);
      }
      return session;
    }
    const session = AdventureSession.startRun({ runSeed: adventureSeed });
    bindInteractionHost(session);
    return session;
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

