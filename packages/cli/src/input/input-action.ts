export type InputActionId = string;

export type InputValueKind = 'digital' | 'char' | 'digit';

export type InputActionDef = {
  id: InputActionId;
  valueKind: InputValueKind;
  /** When true, a match in this context stops lower-priority contexts. */
  consume: boolean;
};

export type TriggeredInputAction = {
  id: InputActionId;
  char?: string;
  digit?: number;
};

export const IA = {
  Quit: 'IA_Quit',
  ToggleInventory: 'IA_ToggleInventory',
  ToggleConsole: 'IA_ToggleConsole',
  ToggleTrace: 'IA_ToggleTrace',
  Escape: 'IA_Escape',
  HandPrev: 'IA_HandPrev',
  HandNext: 'IA_HandNext',
  EnemyPrev: 'IA_EnemyPrev',
  EnemyNext: 'IA_EnemyNext',
  PlayCard: 'IA_PlayCard',
  EndTurn: 'IA_EndTurn',
  CancelPreview: 'IA_CancelPreview',
  TogglePlayerStats: 'IA_TogglePlayerStats',
  ToggleEnemyStats: 'IA_ToggleEnemyStats',
  SelectHand: 'IA_SelectHand',
  InventoryPrev: 'IA_InventoryPrev',
  InventoryNext: 'IA_InventoryNext',
  InventoryToggleFocus: 'IA_InventoryToggleFocus',
  PickupLoot: 'IA_PickupLoot',
  PickupAllLoot: 'IA_PickupAllLoot',
  DiscardInventory: 'IA_DiscardInventory',
  TidyInventory: 'IA_TidyInventory',
  EquipItem: 'IA_EquipItem',
  UnequipSlot: 'IA_UnequipSlot',
  InventoryPlaceChar: 'IA_InventoryPlaceChar',
  InventoryPlaceBackspace: 'IA_InventoryPlaceBackspace',
  InventoryPlaceSubmit: 'IA_InventoryPlaceSubmit',
  ConsoleChar: 'IA_ConsoleChar',
  ConsoleBackspace: 'IA_ConsoleBackspace',
  ConsoleSubmit: 'IA_ConsoleSubmit',
} as const;

export const INPUT_ACTIONS: Readonly<Record<string, InputActionDef>> = {
  [IA.Quit]: { id: IA.Quit, valueKind: 'digital', consume: true },
  [IA.ToggleInventory]: { id: IA.ToggleInventory, valueKind: 'digital', consume: true },
  [IA.ToggleConsole]: { id: IA.ToggleConsole, valueKind: 'digital', consume: true },
  [IA.ToggleTrace]: { id: IA.ToggleTrace, valueKind: 'digital', consume: true },
  [IA.Escape]: { id: IA.Escape, valueKind: 'digital', consume: true },
  [IA.HandPrev]: { id: IA.HandPrev, valueKind: 'digital', consume: true },
  [IA.HandNext]: { id: IA.HandNext, valueKind: 'digital', consume: true },
  [IA.EnemyPrev]: { id: IA.EnemyPrev, valueKind: 'digital', consume: true },
  [IA.EnemyNext]: { id: IA.EnemyNext, valueKind: 'digital', consume: true },
  [IA.PlayCard]: { id: IA.PlayCard, valueKind: 'digital', consume: true },
  [IA.EndTurn]: { id: IA.EndTurn, valueKind: 'digital', consume: true },
  [IA.CancelPreview]: { id: IA.CancelPreview, valueKind: 'digital', consume: true },
  [IA.TogglePlayerStats]: { id: IA.TogglePlayerStats, valueKind: 'digital', consume: true },
  [IA.ToggleEnemyStats]: { id: IA.ToggleEnemyStats, valueKind: 'digital', consume: true },
  [IA.SelectHand]: { id: IA.SelectHand, valueKind: 'digit', consume: true },
  [IA.InventoryPrev]: { id: IA.InventoryPrev, valueKind: 'digital', consume: true },
  [IA.InventoryNext]: { id: IA.InventoryNext, valueKind: 'digital', consume: true },
  [IA.InventoryToggleFocus]: { id: IA.InventoryToggleFocus, valueKind: 'digital', consume: true },
  [IA.PickupLoot]: { id: IA.PickupLoot, valueKind: 'digital', consume: true },
  [IA.PickupAllLoot]: { id: IA.PickupAllLoot, valueKind: 'digital', consume: true },
  [IA.DiscardInventory]: { id: IA.DiscardInventory, valueKind: 'digital', consume: true },
  [IA.TidyInventory]: { id: IA.TidyInventory, valueKind: 'digital', consume: true },
  [IA.EquipItem]: { id: IA.EquipItem, valueKind: 'digital', consume: true },
  [IA.UnequipSlot]: { id: IA.UnequipSlot, valueKind: 'digital', consume: true },
  [IA.InventoryPlaceChar]: { id: IA.InventoryPlaceChar, valueKind: 'char', consume: true },
  [IA.InventoryPlaceBackspace]: { id: IA.InventoryPlaceBackspace, valueKind: 'digital', consume: true },
  [IA.InventoryPlaceSubmit]: { id: IA.InventoryPlaceSubmit, valueKind: 'digital', consume: true },
  [IA.ConsoleChar]: { id: IA.ConsoleChar, valueKind: 'char', consume: true },
  [IA.ConsoleBackspace]: { id: IA.ConsoleBackspace, valueKind: 'digital', consume: true },
  [IA.ConsoleSubmit]: { id: IA.ConsoleSubmit, valueKind: 'digital', consume: true },
};
