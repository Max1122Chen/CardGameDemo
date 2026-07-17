import type { AppState, FocusLayer, UiAction } from '../types.js';
import { activeContextsForState } from './bindings/active-contexts.js';
import type { ParsedKey } from './key-events.js';
import { resolveInput } from './input-system.js';
import { mapTriggeredToUiActions } from './to-ui-actions.js';

function layerForOverlay(overlay: AppState['overlay']): FocusLayer {
  switch (overlay) {
    case 'inventory':
      return 'inventory';
    case 'settings':
      return 'settings';
    case 'console':
      return 'console';
    default:
      return 'gameplay';
  }
}

export function createInitialAppState(options: {
  runtimeMode: AppState['runtimeMode'];
  seed?: number;
  scenarioId?: string;
}): AppState {
  const showTracePane = options.runtimeMode === 'debug';
  const overlay = options.runtimeMode === 'debug' ? 'console' : 'none';

  return {
    runtimeMode: options.runtimeMode,
    overlay,
    focusLayer: layerForOverlay(overlay),
    showTracePane,
    seed: options.seed,
    scenarioId: options.scenarioId,
    selectedHandIndex: 0,
    selectedEnemyIndex: 0,
    hand: [],
    enemies: [],
    playerHealth: 0,
    playerBlock: 0,
    actionPoints: 0,
    combatPhase: 'Setup',
    turnOwner: 'player',
    combatLog: [],
    consoleInput: '',
    consoleScrollback: [],
    statusMessage: 'Select card/enemy to preview. Space commit | Esc/x cancel | F end turn | P/E stats.',
    shouldQuit: false,
    previewActive: false,
    preview: undefined,
    statsOverlay: 'none',
    playerStats: undefined,
    enemyStats: undefined,
    inventoryWidth: 4,
    inventoryHeight: 6,
    inventorySlots: [],
    inventoryGrid: [],
    pendingLoot: [],
    equipmentSlots: [],
    inventoryFocus: 'backpack',
    selectedLootIndex: 0,
    selectedInventorySlot: 0,
    selectedEquipmentSlot: 0,
    inventoryPlaceInput: '',
  };
}

/** Resolve ParsedKey → UiAction[] via IMC/IA (minEngine-style). */
export function routeInput(state: AppState, key: ParsedKey): UiAction[] {
  const triggered = resolveInput(activeContextsForState(state), key);
  return mapTriggeredToUiActions(state, triggered);
}

export function applyOverlayToggle(state: AppState, overlay: AppState['overlay']): AppState {
  const nextOverlay = state.overlay === overlay ? 'none' : overlay;
  // Loot stays on the bottom Hand pane; bag opens focused on equipment (left).
  const inventoryFocus =
    nextOverlay === 'inventory'
      ? 'equipment'
      : state.inventoryFocus;
  return {
    ...state,
    overlay: nextOverlay,
    focusLayer: layerForOverlay(nextOverlay),
    inventoryFocus,
    selectedLootIndex: 0,
    selectedInventorySlot: 0,
    selectedEquipmentSlot: 0,
    inventoryPlaceInput: '',
  };
}
