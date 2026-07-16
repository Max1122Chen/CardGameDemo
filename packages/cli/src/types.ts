export type CliRuntimeMode = 'trace' | 'battle' | 'debug';

export type StatsOverlayTarget = 'none' | 'player' | 'enemy';

export type PrimaryStatsView = {
  strength: number;
  constitution: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type EntityStatsView = {
  health: number;
  maxHealth: number;
  block: number;
  actionPoints?: number;
  maxActionPoints?: number;
  primaries: PrimaryStatsView;
  damageScaling?: number;
  damageMultiplier?: number;
  damageOffset?: number;
};

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
  damageBreakdown?: {
    panel: number;
    bonus: number;
    scaling: number;
    multiplier: number;
    offset: number;
    outgoing: number;
  };
};

export type InventoryFocus = 'loot' | 'backpack';

export type InventorySlotView = {
  slotIndex: number;
  entryId: string;
  itemId: string;
  name: string;
  quantity: number;
  sellValue: number;
  label: string;
  x: number;
  y: number;
  rotation: 0 | 90;
  width: number;
  height: number;
};

export type InventoryGridCellView = {
  glyph: string;
  entryId?: string;
  selected?: boolean;
};

export type LootEntryView = {
  lootIndex: number;
  itemId: string;
  name: string;
  quantity: number;
  sellValue: number;
  label: string;
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
  statsOverlay: StatsOverlayTarget;
  playerStats?: EntityStatsView;
  enemyStats?: EntityStatsView;
  inventoryWidth: number;
  inventoryHeight: number;
  inventorySlots: InventorySlotView[];
  inventoryGrid: InventoryGridCellView[][];
  pendingLoot: LootEntryView[];
  inventoryFocus: InventoryFocus;
  selectedLootIndex: number;
  selectedInventorySlot: number;
  inventoryPlaceInput: string;
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
  | { type: 'toggle_player_stats' }
  | { type: 'toggle_enemy_stats' }
  | { type: 'close_stats_overlay' }
  | { type: 'inventory_prev' }
  | { type: 'inventory_next' }
  | { type: 'inventory_toggle_focus' }
  | { type: 'pickup_selected_loot' }
  | { type: 'pickup_all_loot' }
  | { type: 'discard_selected_inventory_slot' }
  | { type: 'tidy_inventory' }
  | { type: 'inventory_place_append'; char: string }
  | { type: 'inventory_place_backspace' }
  | { type: 'inventory_place_submit' }
  | { type: 'console_append'; char: string }
  | { type: 'console_backspace' }
  | { type: 'console_submit' };
