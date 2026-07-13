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
    if (state.overlay !== 'none') {
      return [{ type: 'close_overlay' }];
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
    if (key.char === 't' || key.char === 'T') {
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
    combatLog: [],
    consoleInput: '',
    consoleScrollback: [],
    statusMessage: 'Use hjkl / arrows to navigate. Space plays selected card.',
    shouldQuit: false,
  };
}

export function routeInput(state: AppState, key: ParsedKey): UiAction[] {
  const globals = globalActions(state, key);
  if (globals.length > 0) {
    return globals;
  }

  if (state.focusLayer === 'console') {
    return consoleActions(key);
  }

  if (state.focusLayer === 'gameplay') {
    return gameplayActions(key);
  }

  return [];
}

export function applyOverlayToggle(state: AppState, overlay: AppState['overlay']): AppState {
  const nextOverlay = state.overlay === overlay ? 'none' : overlay;
  return {
    ...state,
    overlay: nextOverlay,
    focusLayer: layerForOverlay(nextOverlay),
  };
}
