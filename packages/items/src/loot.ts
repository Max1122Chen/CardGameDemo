import type { ItemId } from './item-definition.js';
import type { ItemDefinition } from './item-definition.js';
import type { BattleRewardsTable } from './data/item-bootstrap.js';
import {
  addToInventory,
  placeLootAt,
  type InventoryState,
  type Rotation,
} from './inventory.js';

export type PendingLootEntry = {
  lootIndex: number;
  itemId: ItemId;
  quantity: number;
};

export type PendingLootState = {
  entries: PendingLootEntry[];
};

export function createPendingLootFromTable(table: BattleRewardsTable): PendingLootState {
  return {
    entries: table.entries.map((entry, lootIndex) => ({
      lootIndex,
      itemId: entry.itemId,
      quantity: entry.quantity,
    })),
  };
}

export function hasPendingLoot(loot: PendingLootState | undefined): boolean {
  return (loot?.entries.length ?? 0) > 0;
}

export type LootEntryView = {
  lootIndex: number;
  itemId: ItemId;
  name: string;
  quantity: number;
  sellValue: number;
  label: string;
};

export function listPendingLoot(
  loot: PendingLootState,
  catalog: Record<ItemId, ItemDefinition>,
): LootEntryView[] {
  return loot.entries.map((entry) => {
    const def = catalog[entry.itemId];
    const name = def?.name ?? entry.itemId;
    return {
      lootIndex: entry.lootIndex,
      itemId: entry.itemId,
      name,
      quantity: entry.quantity,
      sellValue: def?.sellValue ?? 0,
      label: `${name} x${entry.quantity}`,
    };
  });
}

export type PickupLootResult =
  | { ok: true; pickedUp: number; remaining: number }
  | {
      ok: false;
      pickedUp: number;
      remaining: number;
      reason: 'inventory_full' | 'unknown_item' | 'out_of_bounds' | 'collision' | 'invalid_rotation';
    }
  | { ok: false; reason: 'no_loot' | 'invalid_index' };

function applyAddResult(
  loot: PendingLootState,
  entryIndex: number,
  entry: PendingLootEntry,
  addResult: { ok: boolean; added: number; reason?: string },
): PickupLootResult {
  if (addResult.added === 0) {
    const reason =
      addResult.reason === 'unknown_item'
        ? 'unknown_item'
        : addResult.reason === 'out_of_bounds'
          ? 'out_of_bounds'
          : addResult.reason === 'collision'
            ? 'collision'
            : addResult.reason === 'invalid_rotation'
              ? 'invalid_rotation'
              : 'inventory_full';
    return {
      ok: false,
      pickedUp: 0,
      remaining: entry.quantity,
      reason,
    };
  }

  const remaining = entry.quantity - addResult.added;
  if (remaining <= 0) {
    loot.entries.splice(entryIndex, 1);
    loot.entries.forEach((lootEntry, index) => {
      lootEntry.lootIndex = index;
    });
  } else {
    entry.quantity = remaining;
  }

  if (addResult.ok) {
    return { ok: true, pickedUp: addResult.added, remaining };
  }

  return {
    ok: false,
    pickedUp: addResult.added,
    remaining,
    reason: 'inventory_full',
  };
}

export function pickupLootEntry(
  loot: PendingLootState,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  lootIndex: number,
): PickupLootResult {
  const entryIndex = loot.entries.findIndex((entry) => entry.lootIndex === lootIndex);
  if (entryIndex < 0) {
    return { ok: false, reason: 'invalid_index' };
  }

  const entry = loot.entries[entryIndex];
  if (!entry) {
    return { ok: false, reason: 'invalid_index' };
  }

  const addResult = addToInventory(inventory, catalog, entry.itemId, entry.quantity);
  return applyAddResult(loot, entryIndex, entry, addResult);
}

export function placePendingLootEntry(
  loot: PendingLootState,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  lootIndex: number,
  x: number,
  y: number,
  rotation: Rotation,
): PickupLootResult {
  const entryIndex = loot.entries.findIndex((entry) => entry.lootIndex === lootIndex);
  if (entryIndex < 0) {
    return { ok: false, reason: 'invalid_index' };
  }

  const entry = loot.entries[entryIndex];
  if (!entry) {
    return { ok: false, reason: 'invalid_index' };
  }

  const addResult = placeLootAt(inventory, catalog, entry.itemId, entry.quantity, x, y, rotation);
  return applyAddResult(loot, entryIndex, entry, addResult);
}

export function pickupAllLoot(
  loot: PendingLootState,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
): { pickedEntries: number; partial: boolean } {
  let pickedEntries = 0;
  let partial = false;

  while (loot.entries.length > 0) {
    const entry = loot.entries[0];
    if (!entry) {
      break;
    }
    const result = pickupLootEntry(loot, inventory, catalog, entry.lootIndex);
    if (!result.ok) {
      if ('pickedUp' in result && result.pickedUp > 0) {
        pickedEntries += 1;
      }
      partial = true;
      break;
    }
    pickedEntries += 1;
  }

  return { pickedEntries, partial };
}

export function validateBattleRewards(
  table: BattleRewardsTable,
  catalog: Record<ItemId, ItemDefinition>,
): void {
  for (const entry of table.entries) {
    if (!catalog[entry.itemId]) {
      throw new Error(`Battle reward references unknown item: ${entry.itemId}`);
    }
    if (!Number.isInteger(entry.quantity) || entry.quantity < 1) {
      throw new Error(`Battle reward quantity must be positive for item: ${entry.itemId}`);
    }
  }
}
