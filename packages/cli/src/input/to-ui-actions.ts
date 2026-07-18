import { isExplorePhase, isLootHandMode } from '../ui-mode.js';
import type { AppState, UiAction } from '../types.js';
import { IA, type TriggeredInputAction } from './input-action.js';

/**
 * Map triggered InputActions to existing UiActions.
 * Escape is contextual (stats → overlay → preview → settings).
 */
export function mapTriggeredToUiActions(
  state: AppState,
  triggered: readonly TriggeredInputAction[],
): UiAction[] {
  const actions: UiAction[] = [];
  const lootMode = isLootHandMode(state);

  for (const event of triggered) {
    switch (event.id) {
      case IA.Quit:
        actions.push({ type: 'quit' });
        break;
      case IA.ToggleInventory:
        actions.push({ type: 'toggle_inventory' });
        break;
      case IA.ToggleConsole:
        actions.push({ type: 'toggle_console' });
        break;
      case IA.ToggleTrace:
        // Inventory owns T for tidy (IMC_Inventory consumes); Global T only when not inventory.
        if (state.focusLayer !== 'inventory') {
          actions.push({ type: 'toggle_trace_pane' });
        }
        break;
      case IA.Escape:
        actions.push(...resolveEscape(state));
        break;
      case IA.HandPrev:
        actions.push({ type: 'hand_prev' });
        break;
      case IA.HandNext:
        actions.push({ type: 'hand_next' });
        break;
      case IA.EnemyPrev:
        actions.push({ type: 'enemy_prev' });
        break;
      case IA.EnemyNext:
        actions.push({ type: 'enemy_next' });
        break;
      case IA.PlayCard:
        actions.push({ type: 'play_selected_card' });
        break;
      case IA.EndTurn:
        actions.push({ type: 'end_turn' });
        break;
      case IA.CancelPreview:
        actions.push({ type: 'cancel_card_preview' });
        break;
      case IA.TogglePlayerStats:
        // Post-combat loot: P = pickup (stats idle until next battle).
        actions.push({ type: lootMode ? 'pickup_selected_loot' : 'toggle_player_stats' });
        break;
      case IA.ToggleEnemyStats:
        if (!lootMode && state.combatResult === undefined) {
          actions.push({ type: 'toggle_enemy_stats' });
        }
        break;
      case IA.SelectHand:
        if (event.digit !== undefined) {
          actions.push({ type: 'select_hand', index: event.digit - 1 });
        }
        break;
      case IA.InventoryPrev:
        actions.push({ type: 'inventory_prev' });
        break;
      case IA.InventoryNext:
        actions.push({ type: 'inventory_next' });
        break;
      case IA.InventoryToggleFocus:
        actions.push({ type: 'inventory_toggle_focus' });
        break;
      case IA.PickupLoot:
        actions.push({ type: 'pickup_selected_loot' });
        break;
      case IA.PickupAllLoot:
        if (lootMode || state.focusLayer === 'inventory') {
          actions.push({ type: 'pickup_all_loot' });
        }
        break;
      case IA.DiscardInventory:
        actions.push({ type: 'discard_selected_inventory_slot' });
        break;
      case IA.TidyInventory:
        actions.push({ type: 'tidy_inventory' });
        break;
      case IA.EquipItem:
        actions.push({ type: 'equip_selected_item' });
        break;
      case IA.UnequipSlot:
        actions.push({ type: 'unequip_selected_slot' });
        break;
      case IA.InventoryPlaceChar:
        if (event.char !== undefined) {
          actions.push({ type: 'inventory_place_append', char: event.char });
        }
        break;
      case IA.InventoryPlaceBackspace:
        actions.push({ type: 'inventory_place_backspace' });
        break;
      case IA.InventoryPlaceSubmit:
        actions.push({ type: 'inventory_place_submit' });
        break;
      case IA.ConsoleChar:
        if (event.char !== undefined) {
          actions.push({ type: 'console_append', char: event.char });
        }
        break;
      case IA.ConsoleBackspace:
        actions.push({ type: 'console_backspace' });
        break;
      case IA.ConsoleSubmit:
        actions.push({ type: 'console_submit' });
        break;
      case IA.ExploreMoveNorth:
        actions.push({ type: 'explore_move', direction: 'north' });
        break;
      case IA.ExploreMoveSouth:
        actions.push({ type: 'explore_move', direction: 'south' });
        break;
      case IA.ExploreMoveEast:
        actions.push({ type: 'explore_move', direction: 'east' });
        break;
      case IA.ExploreMoveWest:
        actions.push({ type: 'explore_move', direction: 'west' });
        break;
      case IA.ConfirmCombat:
        if (isExplorePhase(state)) {
          actions.push({ type: 'confirm_combat' });
        }
        break;
      case IA.LeaveLevel:
        if (isExplorePhase(state)) {
          actions.push({ type: 'leave_level' });
        }
        break;
      case IA.EndExploreRound:
        if (isExplorePhase(state)) {
          actions.push({ type: 'end_explore_round' });
        }
        break;
      case IA.PickupRoomLoot:
        if (isExplorePhase(state)) {
          actions.push({ type: 'pickup_room_loot' });
        }
        break;
      case IA.SelectRoomLoot:
        if (isExplorePhase(state) && event.digit !== undefined) {
          if (state.interactionPrompt) {
            actions.push({ type: 'choose_interact_option', index: event.digit - 1 });
          } else if (state.interactPickMode) {
            actions.push({ type: 'begin_interact_at', index: event.digit - 1 });
          } else {
            actions.push({ type: 'select_room_loot', index: event.digit - 1 });
          }
        }
        break;
      case IA.BeginInteract:
        if (isExplorePhase(state)) {
          actions.push({ type: 'begin_interact_flow' });
        }
        break;
      case IA.CancelInteract:
        if (isExplorePhase(state)) {
          actions.push({ type: 'cancel_interact' });
        }
        break;
      default:
        break;
    }
  }

  return actions;
}

function resolveEscape(state: AppState): UiAction[] {
  if (state.focusLayer === 'console' || state.focusLayer === 'inventory' || state.focusLayer === 'settings') {
    return [{ type: 'close_overlay' }];
  }
  if (state.statsOverlay !== 'none') {
    return [{ type: 'close_stats_overlay' }];
  }
  if (state.previewActive) {
    return [{ type: 'cancel_card_preview' }];
  }
  return [{ type: 'toggle_settings' }];
}
