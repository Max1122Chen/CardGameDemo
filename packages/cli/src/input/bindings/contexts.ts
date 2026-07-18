import { IA } from '../input-action.js';
import type { InputMappingContext } from '../input-mapping.js';

/** Always-on: quit / overlay toggles that are safe when not consumed by a higher IMC. */
export const IMC_Global: InputMappingContext = {
  id: 'IMC_Global',
  mappings: [
    { actionId: IA.Quit, match: { type: 'kind', kind: 'ctrl_c' } },
    { actionId: IA.Quit, match: { type: 'char', char: 'q', ignoreCase: true } },
    { actionId: IA.ToggleInventory, match: { type: 'char', char: 'b', ignoreCase: true } },
    { actionId: IA.ToggleConsole, match: { type: 'char', char: '`' } },
    { actionId: IA.ToggleConsole, match: { type: 'char', char: '~' } },
    { actionId: IA.ToggleTrace, match: { type: 'char', char: 't', ignoreCase: true } },
    { actionId: IA.Escape, match: { type: 'kind', kind: 'escape' } },
  ],
};

/** Console owns typing; consume so Global never sees b/q/t while open. */
export const IMC_Console: InputMappingContext = {
  id: 'IMC_Console',
  mappings: [
    { actionId: IA.Escape, match: { type: 'kind', kind: 'escape' } },
    { actionId: IA.ToggleConsole, match: { type: 'char', char: '`' } },
    { actionId: IA.ToggleConsole, match: { type: 'char', char: '~' } },
    { actionId: IA.ConsoleSubmit, match: { type: 'kind', kind: 'enter' } },
    { actionId: IA.ConsoleBackspace, match: { type: 'kind', kind: 'backspace' } },
    { actionId: IA.ConsoleChar, match: { type: 'any_char' } },
    // Keep Ctrl+C as quit even in console (also on Global; either works).
    { actionId: IA.Quit, match: { type: 'kind', kind: 'ctrl_c' } },
  ],
};

export const IMC_Inventory: InputMappingContext = {
  id: 'IMC_Inventory',
  mappings: [
    { actionId: IA.InventoryPrev, match: { type: 'kind', kind: 'up' } },
    { actionId: IA.InventoryNext, match: { type: 'kind', kind: 'down' } },
    { actionId: IA.InventoryPlaceSubmit, match: { type: 'kind', kind: 'enter' } },
    { actionId: IA.InventoryPlaceBackspace, match: { type: 'kind', kind: 'backspace' } },
    { actionId: IA.PickupLoot, match: { type: 'char', char: 'p', ignoreCase: true } },
    { actionId: IA.PickupAllLoot, match: { type: 'char', char: 'a', ignoreCase: true } },
    { actionId: IA.DiscardInventory, match: { type: 'char', char: 'd', ignoreCase: true } },
    { actionId: IA.TidyInventory, match: { type: 'char', char: 't', ignoreCase: true } },
    { actionId: IA.EquipItem, match: { type: 'char', char: 'e', ignoreCase: true } },
    { actionId: IA.UnequipSlot, match: { type: 'char', char: 'u', ignoreCase: true } },
    { actionId: IA.InventoryToggleFocus, match: { type: 'char', char: '\t' } },
    { actionId: IA.InventoryPlaceChar, match: { type: 'place_char' } },
  ],
};

export const IMC_Gameplay: InputMappingContext = {
  id: 'IMC_Gameplay',
  mappings: [
    { actionId: IA.HandPrev, match: { type: 'kind', kind: 'left' } },
    { actionId: IA.HandNext, match: { type: 'kind', kind: 'right' } },
    { actionId: IA.EnemyPrev, match: { type: 'kind', kind: 'up' } },
    { actionId: IA.EnemyNext, match: { type: 'kind', kind: 'down' } },
    { actionId: IA.PlayCard, match: { type: 'kind', kind: 'enter' } },
    { actionId: IA.HandPrev, match: { type: 'char', char: 'h' } },
    { actionId: IA.HandNext, match: { type: 'char', char: 'l' } },
    { actionId: IA.PlayCard, match: { type: 'char', char: ' ' } },
    { actionId: IA.EndTurn, match: { type: 'char', char: 'f', ignoreCase: true } },
    { actionId: IA.TogglePlayerStats, match: { type: 'char', char: 'p', ignoreCase: true } },
    { actionId: IA.ToggleEnemyStats, match: { type: 'char', char: 'e', ignoreCase: true } },
    { actionId: IA.PickupAllLoot, match: { type: 'char', char: 'a', ignoreCase: true } },
    { actionId: IA.CancelPreview, match: { type: 'char', char: 'x', ignoreCase: true } },
    { actionId: IA.SelectHand, match: { type: 'digit' } },
  ],
};

/** When stats overlay is open, Esc closes it before Gameplay/Global Esc. */
export const IMC_Stats: InputMappingContext = {
  id: 'IMC_Stats',
  mappings: [{ actionId: IA.Escape, match: { type: 'kind', kind: 'escape' } }],
};

export const IMC_Settings: InputMappingContext = {
  id: 'IMC_Settings',
  mappings: [{ actionId: IA.Escape, match: { type: 'kind', kind: 'escape' } }],
};

/** Explore phase: movement, confirm combat, room loot. */
export const IMC_Explore: InputMappingContext = {
  id: 'IMC_Explore',
  mappings: [
    { actionId: IA.ExploreMoveNorth, match: { type: 'kind', kind: 'up' } },
    { actionId: IA.ExploreMoveSouth, match: { type: 'kind', kind: 'down' } },
    { actionId: IA.ExploreMoveEast, match: { type: 'kind', kind: 'right' } },
    { actionId: IA.ExploreMoveWest, match: { type: 'kind', kind: 'left' } },
    { actionId: IA.ExploreMoveNorth, match: { type: 'char', char: 'w', ignoreCase: true } },
    { actionId: IA.ExploreMoveSouth, match: { type: 'char', char: 's', ignoreCase: true } },
    { actionId: IA.ExploreMoveEast, match: { type: 'char', char: 'd', ignoreCase: true } },
    { actionId: IA.ExploreMoveWest, match: { type: 'char', char: 'a', ignoreCase: true } },
    { actionId: IA.ConfirmCombat, match: { type: 'kind', kind: 'enter' } },
    { actionId: IA.ConfirmCombat, match: { type: 'char', char: 'c', ignoreCase: true } },
    { actionId: IA.LeaveLevel, match: { type: 'char', char: 'l', ignoreCase: true } },
    { actionId: IA.EndExploreRound, match: { type: 'char', char: 'f', ignoreCase: true } },
    { actionId: IA.PickupRoomLoot, match: { type: 'char', char: 'p', ignoreCase: true } },
    { actionId: IA.SelectRoomLoot, match: { type: 'digit' } },
  ],
};
