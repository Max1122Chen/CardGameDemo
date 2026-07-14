export type CliRuntimeMode = 'trace' | 'battle' | 'debug';

export type OverlayId = 'none' | 'inventory' | 'settings' | 'console';

export type FocusLayer = 'gameplay' | 'inventory' | 'settings' | 'console';

export type HandCard = {
  id: string;
  name: string;
  cost: number;
};

export type EnemyView = {
  id: string;
  name: string;
  health: number;
  intent: string;
  block?: number;
  previewDamageToTake?: number;
};

export type CombatPreviewView = {
  handIndex: number;
  actionId: string;
  targetEntityId: string;
  damage?: number;
  damageToTake?: number;
  blockToGain?: number;
};

export type AppState = {
  runtimeMode: CliRuntimeMode;
  overlay: OverlayId;
  focusLayer: FocusLayer;
  showTracePane: boolean;
  seed?: number;
  scenarioId?: string;
  selectedHandIndex: number;
  selectedEnemyIndex: number;
  hand: HandCard[];
  enemies: EnemyView[];
  playerHealth: number;
  playerBlock: number;
  actionPoints: number;
  combatPhase: string;
  turnOwner: 'player' | 'enemy';
  combatResult?: 'victory' | 'defeat';
  combatLog: string[];
  consoleInput: string;
  consoleScrollback: string[];
  statusMessage: string;
  shouldQuit: boolean;
  previewActive: boolean;
  preview?: CombatPreviewView;
};

export type UiAction =
  | { type: 'toggle_inventory' }
  | { type: 'toggle_settings' }
  | { type: 'toggle_console' }
  | { type: 'close_overlay' }
  | { type: 'toggle_trace_pane' }
  | { type: 'quit' }
  | { type: 'hand_prev' }
  | { type: 'hand_next' }
  | { type: 'enemy_prev' }
  | { type: 'enemy_next' }
  | { type: 'select_hand'; index: number }
  | { type: 'play_selected_card' }
  | { type: 'cancel_card_preview' }
  | { type: 'end_turn' }
  | { type: 'console_append'; char: string }
  | { type: 'console_backspace' }
  | { type: 'console_submit' };
