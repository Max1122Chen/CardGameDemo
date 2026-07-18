import {
  addToInventory,
  buildDeckIdsFromLoadout,
  discardInventoryEntry,
  equipFromInventory,
  moveInventoryEntry,
  pickupAllLoot,
  pickupLootEntry,
  placePendingLootEntry,
  tidyInventory,
  unequipToInventory,
  type Rotation,
} from '@cardgame/items';
import {
  activateDungeonMove,
  beginAdventureCombat,
  ensureExplorePlayerForMove,
} from '@cardgame/dungeon';

import { executeConsoleCommand } from '../console/console-executor.js';
import { applyOverlayToggle } from '../input/input-router.js';
import type { AppState, UiAction } from '../types.js';
import { isAdventureCombatPhase, isExplorePhase } from '../ui-mode.js';
import { clampIndex } from './clamp.js';
import { nextInventoryFocus } from './session-view-sync.js';
import type { SessionController } from './session-types.js';

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
          const levelCount = controller.adventure.getLevelCount();
          controller.adventure.applyAction({ type: 'LeaveLevel' });
          const descended = controller.adventure.getPhase() === 'explore';
          return controller.syncViewState({
            ...state,
            statusMessage: descended
              ? `Descended to floor ${controller.adventure.getLevelIndex() + 1}/${levelCount}.`
              : levelCount > 1
                ? 'Evacuated — dungeon cleared!'
                : 'Left the level.',
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
        const levelCount = controller.adventure.getLevelCount();
        controller.adventure.applyAction({ type: 'LeaveLevel' });
        const descended = controller.adventure.getPhase() === 'explore';
        return controller.syncViewState({
          ...state,
          statusMessage: descended
            ? `Descended to floor ${controller.adventure.getLevelIndex() + 1}/${levelCount}.`
            : levelCount > 1
              ? 'Evacuated — dungeon cleared!'
              : 'Left the level.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot leave.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
    }
    case 'end_explore_round': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      try {
        controller.adventure.applyAction({ type: 'EndRound' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot end round.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
      const snap = controller.adventure.getSnapshot();
      return controller.syncViewState({
        ...state,
        statusMessage: `Round ${snap.round} — AP ${snap.exploreAp}/${snap.maxExploreAp}.`,
      });
    }
    case 'begin_interact_flow': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      if (controller.adventure.isInteractionActive()) {
        try {
          controller.adventure.applyAction({ type: 'CancelInteract' });
        } catch {
          /* ignore */
        }
        return controller.syncViewState({
          ...state,
          interactPickMode: false,
          statusMessage: 'Interaction cancelled.',
        });
      }
      const list = controller.adventure
        .listRoomInteractables()
        .filter((item) => item.canInteract);
      if (list.length === 0) {
        return {
          ...controller.syncViewState(state),
          interactPickMode: false,
          statusMessage: 'Nothing to interact with here.',
        };
      }
      if (list.length === 1) {
        try {
          controller.adventure.applyAction({
            type: 'BeginInteract',
            interactableId: list[0]!.id,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cannot interact.';
          return { ...controller.syncViewState(state), statusMessage: message };
        }
        return controller.syncViewState({
          ...state,
          interactPickMode: false,
        });
      }
      const names = list.map((item, i) => `${i + 1}:${item.displayName}`).join(' ');
      return {
        ...controller.syncViewState(state),
        interactPickMode: true,
        statusMessage: `Interact — ${names} (digit) | X cancel`,
      };
    }
    case 'begin_interact_at': {
      if (!isExplorePhase(state) || !controller.adventure || !state.interactPickMode) {
        return state;
      }
      const list = controller.adventure
        .listRoomInteractables()
        .filter((item) => item.canInteract);
      const target = list[action.index];
      if (!target) {
        return { ...state, statusMessage: 'Invalid interactable.' };
      }
      try {
        controller.adventure.applyAction({
          type: 'BeginInteract',
          interactableId: target.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot interact.';
        return {
          ...controller.syncViewState(state),
          interactPickMode: false,
          statusMessage: message,
        };
      }
      return controller.syncViewState({ ...state, interactPickMode: false });
    }
    case 'choose_interact_option': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      const options = state.interactionOptions ?? [];
      const option = options[action.index];
      if (!option) {
        return { ...state, statusMessage: 'Invalid option.' };
      }
      try {
        controller.adventure.applyAction({
          type: 'ChooseInteractOption',
          optionId: option.id,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Cannot choose.';
        return { ...controller.syncViewState(state), statusMessage: message };
      }
      return controller.syncViewState(state);
    }
    case 'cancel_interact': {
      if (!isExplorePhase(state) || !controller.adventure) {
        return state;
      }
      if (controller.adventure.isInteractionActive()) {
        try {
          controller.adventure.applyAction({ type: 'CancelInteract' });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Cannot cancel.';
          return { ...controller.syncViewState(state), statusMessage: message };
        }
        return controller.syncViewState({
          ...state,
          interactPickMode: false,
          statusMessage: 'Interaction cancelled.',
        });
      }
      if (state.interactPickMode) {
        return {
          ...controller.syncViewState(state),
          interactPickMode: false,
          statusMessage: 'Interact cancelled.',
        };
      }
      return state;
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

