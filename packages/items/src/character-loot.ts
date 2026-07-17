import { getEquipmentFragment } from './fragments.js';
import { listEquippedPieces } from './equipment-loadout.js';
import { listInventorySlots } from './inventory.js';
import type { EquipmentLoadout } from './equipment-loadout.js';
import type { InventoryState } from './inventory.js';
import type { ItemDefinition, ItemId } from './item-definition.js';
import type { PendingLootState } from './loot.js';

export type CharacterLootRollEntry = {
  itemId: ItemId;
  quantityMin: number;
  quantityMax: number;
};

export type CharacterLootSource = {
  loadout: EquipmentLoadout;
  inventory: InventoryState;
  lootEntries: readonly CharacterLootRollEntry[];
};

function rollQuantity(
  min: number,
  max: number,
  rng: () => number,
): number {
  if (max <= min) {
    return min;
  }
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

export function createPendingLootFromCharacter(
  source: CharacterLootSource,
  catalog: Record<ItemId, ItemDefinition>,
  rng: () => number = Math.random,
): PendingLootState {
  const stacks = new Map<ItemId, number>();

  const addStack = (itemId: ItemId, quantity: number) => {
    if (quantity <= 0) {
      return;
    }
    stacks.set(itemId, (stacks.get(itemId) ?? 0) + quantity);
  };

  for (const piece of listEquippedPieces(source.loadout)) {
    const def = catalog[piece.itemId];
    if (!def) {
      continue;
    }
    const equipment = getEquipmentFragment(def.fragments);
    if (equipment?.innate) {
      continue;
    }
    addStack(piece.itemId, 1);
  }

  for (const slot of listInventorySlots(source.inventory, catalog)) {
    addStack(slot.itemId, slot.quantity);
  }

  for (const entry of source.lootEntries) {
    const quantity = rollQuantity(entry.quantityMin, entry.quantityMax, rng);
    addStack(entry.itemId, quantity);
  }

  const entries = [...stacks.entries()].map(([itemId, quantity], lootIndex) => ({
    lootIndex,
    itemId,
    quantity,
  }));

  return { entries };
}
