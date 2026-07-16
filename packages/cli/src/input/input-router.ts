import type { AppState, FocusLayer, UiAction } from '../types.js';
import type { ParsedKey } from './key-events.js';

function isConsoleToggle(char: string): boolean {
  return char === '`' || char === '~';
}

function isInventoryToggle(char: string): boolean {
  return char === 'b' || char === 'B';
}

function isQuit(char: string): boolean {
  return char === 'q' || char === 'Q';
}

function inventoryActions(key: ParsedKey): UiAction[] {
  switch (key.kind) {
    case 'up':
      return [{ type: 'inventory_prev' }];
    case 'down':
      return [{ type: 'inventory_next' }];
    case 'enter':
      return [{ type: 'inventory_place_submit' }];
    case 'backspace':
      return [{ type: 'inventory_place_backspace' }];
    case 'char': {
      if (key.char === 'p' || key.char === 'P') {
        return [{ type: 'pickup_selected_loot' }];
      }
      if (key.char === 'a' || key.char === 'A') {
        return [{ type: 'pickup_all_loot' }];
      }
      if (key.char === 'd' || key.char === 'D') {
        return [{ type: 'discard_selected_inventory_slot' }];
      }
      if (key.char === 't' || key.char === 'T') {
        return [{ type: 'tidy_inventory' }];
      }
      if (key.char === 'e' || key.char === 'E') {
        return [{ type: 'equip_selected_item' }];
      }
      if (key.char === 'u' || key.char === 'U') {
        return [{ type: 'unequip_selected_slot' }];
      }
      if (key.char === '\t') {
        return [{ type: 'inventory_toggle_focus' }];
      }
      if (/[0-9 ]/.test(key.char)) {
        return [{ type: 'inventory_place_append', char: key.char }];
      }
      return [];
    }
    default:
      return [];
  }
}

function gameplayActions(key: ParsedKey): UiAction[] {
  switch (key.kind) {
    case 'left':
      return [{ type: 'hand_prev' }];
    case 'right':
      return [{ type: 'hand_next' }];
    case 'up':
      return [{ type: 'enemy_prev' }];
    case 'down':
      return [{ type: 'enemy_next' }];
    case 'enter':
      return [{ type: 'play_selected_card' }];
    case 'char': {
      if (key.char === 'h') {
        return [{ type: 'hand_prev' }];
      }
      if (key.char === 'l') {
        return [{ type: 'hand_next' }];
      }
      if (key.char === ' ') {
        return [{ type: 'play_selected_card' }];
      }
      if (key.char === 'f' || key.char === 'F') {
        return [{ type: 'end_turn' }];
      }
      if (key.char === 'p' || key.char === 'P') {
        return [{ type: 'toggle_player_stats' }];
      }
      if (key.char === 'e' || key.char === 'E') {
        return [{ type: 'toggle_enemy_stats' }];
      }
      if (key.char === 'x' || key.char === 'X') {
        return [{ type: 'cancel_card_preview' }];
      }
      const digit = Number(key.char);
      if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
        return [{ type: 'select_hand', index: digit - 1 }];
      }
      return [];
    }
    default:
      return [];
  }
}

function consoleActions(key: ParsedKey): UiAction[] {
  switch (key.kind) {
    case 'enter':
      return [{ type: 'console_submit' }];
    case 'backspace':
      return [{ type: 'console_backspace' }];
    case 'char':
      return [{ type: 'console_append', char: key.char }];
    default:
      return [];
  }
}

function globalActions(state: AppState, key: ParsedKey): UiAction[] {
  if (key.kind === 'ctrl_c' || (key.kind === 'char' && isQuit(key.char))) {
    return [{ type: 'quit' }];
  }

  if (key.kind === 'escape') {
    if (state.statsOverlay !== 'none') {
      return [{ type: 'close_stats_overlay' }];
    }
    if (state.overlay !== 'none') {
      return [{ type: 'close_overlay' }];
    }
    if (state.previewActive) {
      return [{ type: 'cancel_card_preview' }];
    }
    return [{ type: 'toggle_settings' }];
  }

  if (key.kind === 'char') {
    if (isInventoryToggle(key.char)) {
      return [{ type: 'toggle_inventory' }];
    }
    if (isConsoleToggle(key.char)) {
      return [{ type: 'toggle_console' }];
    }
    // T is tidy inside inventory overlay; only toggle trace outside it.
    if ((key.char === 't' || key.char === 'T') && state.focusLayer !== 'inventory') {
      return [{ type: 'toggle_trace_pane' }];
    }
  }

  return [];
}

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

export function routeInput(state: AppState, key: ParsedKey): UiAction[] {
  // Console owns the keyboard while open: do not let B/Q/T/etc. steal keystrokes.
  // Escape / backtick still close; Ctrl+C still quits.
  if (state.focusLayer === 'console') {
    if (key.kind === 'ctrl_c') {
      return [{ type: 'quit' }];
    }
    if (key.kind === 'escape') {
      return [{ type: 'close_overlay' }];
    }
    if (key.kind === 'char' && isConsoleToggle(key.char)) {
      return [{ type: 'toggle_console' }];
    }
    return consoleActions(key);
  }

  const globals = globalActions(state, key);
  if (globals.length > 0) {
    return globals;
  }

  if (state.focusLayer === 'inventory') {
    return inventoryActions(key);
  }

  if (state.focusLayer === 'gameplay') {
    return gameplayActions(key);
  }

  return [];
}

export function applyOverlayToggle(state: AppState, overlay: AppState['overlay']): AppState {
  const nextOverlay = state.overlay === overlay ? 'none' : overlay;
  const inventoryFocus =
    nextOverlay === 'inventory' && state.pendingLoot.length > 0 ? 'loot' : state.inventoryFocus;
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
