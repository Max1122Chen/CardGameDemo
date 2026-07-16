import type { ItemId } from './item-definition.js';
import type { ItemDefinition } from './item-definition.js';
import {
  createInitialInstanceState,
  requiresItemInstance,
  type ItemInstanceState,
} from './fragments.js';

export const DEFAULT_INVENTORY_CAPACITY = 12;

let nextInstanceCounter = 1;

export function resetItemInstanceCounter(forTests = 0): void {
  nextInstanceCounter = forTests > 0 ? forTests : 1;
}

function createInstanceId(): string {
  const id = `item-inst-${nextInstanceCounter}`;
  nextInstanceCounter += 1;
  return id;
}

export type InventoryStackEntry = {
  kind: 'stack';
  itemId: ItemId;
  quantity: number;
};

export type InventoryInstanceEntry = {
  kind: 'instance';
  itemId: ItemId;
  instanceId: string;
  state?: ItemInstanceState;
};

export type InventoryEntry = InventoryStackEntry | InventoryInstanceEntry;

export type InventoryState = {
  capacity: number;
  entries: InventoryEntry[];
};

export type InventoryFailureReason = 'inventory_full' | 'invalid_quantity' | 'unknown_item';

export type InventoryAddResult = {
  ok: boolean;
  added: number;
  reason?: InventoryFailureReason;
};

export function createInventory(capacity = DEFAULT_INVENTORY_CAPACITY): InventoryState {
  return { capacity, entries: [] };
}

function findStackIndex(inventory: InventoryState, itemId: ItemId): number {
  return inventory.entries.findIndex(
    (entry) => entry.kind === 'stack' && entry.itemId === itemId,
  );
}

function countFreeSlots(inventory: InventoryState): number {
  return inventory.capacity - inventory.entries.length;
}

export function canAddToInventory(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
  quantity: number,
): boolean {
  return computeAddableQuantity(inventory, catalog, itemId, quantity) === quantity;
}

export function computeAddableQuantity(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
  quantity: number,
): number {
  const def = catalog[itemId];
  if (!def || !Number.isInteger(quantity) || quantity < 1) {
    return 0;
  }

  if (requiresItemInstance(def.fragments, def.maxStack)) {
    return Math.min(quantity, countFreeSlots(inventory));
  }

  let room = 0;
  const stackIndex = findStackIndex(inventory, itemId);
  if (stackIndex >= 0) {
    const entry = inventory.entries[stackIndex];
    if (entry?.kind === 'stack') {
      room += def.maxStack - entry.quantity;
    }
  }
  room += countFreeSlots(inventory) * def.maxStack;
  return Math.min(quantity, room);
}

export function addToInventory(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
  quantity: number,
): InventoryAddResult {
  const def = catalog[itemId];
  if (!def) {
    return { ok: false, added: 0, reason: 'unknown_item' };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, added: 0, reason: 'invalid_quantity' };
  }

  const addable = computeAddableQuantity(inventory, catalog, itemId, quantity);
  if (addable === 0) {
    return { ok: false, added: 0, reason: 'inventory_full' };
  }

  if (requiresItemInstance(def.fragments, def.maxStack)) {
    for (let index = 0; index < addable; index += 1) {
      inventory.entries.push({
        kind: 'instance',
        itemId,
        instanceId: createInstanceId(),
        state: createInitialInstanceState(def.fragments),
      });
    }
    return { ok: addable === quantity, added: addable, reason: addable === quantity ? undefined : 'inventory_full' };
  }

  let remaining = addable;
  const stackIndex = findStackIndex(inventory, itemId);
  if (stackIndex >= 0) {
    const entry = inventory.entries[stackIndex];
    if (entry?.kind === 'stack') {
      const room = def.maxStack - entry.quantity;
      const merged = Math.min(room, remaining);
      entry.quantity += merged;
      remaining -= merged;
    }
  }

  while (remaining > 0) {
    const chunk = Math.min(remaining, def.maxStack);
    inventory.entries.push({ kind: 'stack', itemId, quantity: chunk });
    remaining -= chunk;
  }

  return { ok: addable === quantity, added: addable, reason: addable === quantity ? undefined : 'inventory_full' };
}

export function discardInventorySlot(inventory: InventoryState, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= inventory.entries.length) {
    return false;
  }
  inventory.entries.splice(slotIndex, 1);
  return true;
}

export type InventorySlotView = {
  slotIndex: number;
  itemId: ItemId;
  name: string;
  quantity: number;
  sellValue: number;
  label: string;
};

export function listInventorySlots(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
): InventorySlotView[] {
  return inventory.entries.map((entry, slotIndex) => {
    const def = catalog[entry.itemId];
    const name = def?.name ?? entry.itemId;
    const sellValue = def?.sellValue ?? 0;
    if (entry.kind === 'stack') {
      return {
        slotIndex,
        itemId: entry.itemId,
        name,
        quantity: entry.quantity,
        sellValue,
        label: `${name} x${entry.quantity}`,
      };
    }
    const durability = entry.state?.durability;
    const durabilityMax = def?.fragments.find((fragment) => fragment.kind === 'durability');
    const maxDurability = durabilityMax?.kind === 'durability' ? durabilityMax.max : durability?.current ?? 0;
    const durabilitySuffix =
      durability !== undefined ? ` (${durability.current}/${maxDurability} dur)` : '';
    return {
      slotIndex,
      itemId: entry.itemId,
      name,
      quantity: 1,
      sellValue,
      label: `${name}${durabilitySuffix}`,
    };
  });
}
