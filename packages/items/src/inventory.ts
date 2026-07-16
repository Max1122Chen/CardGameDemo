import type { ItemId } from './item-definition.js';
import type { ItemDefinition } from './item-definition.js';
import {
  createInitialInstanceState,
  getItemFootprint,
  requiresItemInstance,
  type ItemInstanceState,
} from './fragments.js';

/** Default backpack: width 4 × height 6. */
export const DEFAULT_GRID_WIDTH = 4;
export const DEFAULT_GRID_HEIGHT = 6;
/** @deprecated Prefer width*height grid; kept for CLI cell count display. */
export const DEFAULT_INVENTORY_CAPACITY = DEFAULT_GRID_WIDTH * DEFAULT_GRID_HEIGHT;

export type Rotation = 0 | 90;

let nextInstanceCounter = 1;
let nextEntryCounter = 1;

export function resetItemInstanceCounter(forTests = 0): void {
  nextInstanceCounter = forTests > 0 ? forTests : 1;
  nextEntryCounter = forTests > 0 ? forTests : 1;
}

function createInstanceId(): string {
  const id = `item-inst-${nextInstanceCounter}`;
  nextInstanceCounter += 1;
  return id;
}

function createEntryId(): string {
  const id = `bag-${nextEntryCounter}`;
  nextEntryCounter += 1;
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

export type InventoryPayload = InventoryStackEntry | InventoryInstanceEntry;

export type PlacedInventoryEntry = {
  entryId: string;
  payload: InventoryPayload;
  x: number;
  y: number;
  rotation: Rotation;
};

export type InventoryState = {
  width: number;
  height: number;
  entries: PlacedInventoryEntry[];
};

export type InventoryFailureReason =
  | 'inventory_full'
  | 'invalid_quantity'
  | 'unknown_item'
  | 'out_of_bounds'
  | 'collision'
  | 'unknown_entry'
  | 'invalid_rotation';

export type InventoryAddResult = {
  ok: boolean;
  added: number;
  reason?: InventoryFailureReason;
};

export type PlaceResult =
  | { ok: true }
  | { ok: false; reason: InventoryFailureReason };

export function createInventory(
  width = DEFAULT_GRID_WIDTH,
  height = DEFAULT_GRID_HEIGHT,
): InventoryState {
  return { width, height, entries: [] };
}

export function effectiveFootprint(
  width: number,
  height: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation === 90 ? { width: height, height: width } : { width, height };
}

function footprintForItem(
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
): { width: number; height: number } | undefined {
  const def = catalog[itemId];
  if (!def) {
    return undefined;
  }
  return getItemFootprint(def.fragments);
}

function markOccupancy(
  grid: Array<Array<string | undefined>>,
  entry: PlacedInventoryEntry,
  footprint: { width: number; height: number },
): void {
  const size = effectiveFootprint(footprint.width, footprint.height, entry.rotation);
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) {
      const row = grid[entry.y + dy];
      if (row) {
        row[entry.x + dx] = entry.entryId;
      }
    }
  }
}

function occupancyGrid(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  ignoreEntryId?: string,
): Array<Array<string | undefined>> {
  const grid: Array<Array<string | undefined>> = Array.from({ length: inventory.height }, () =>
    Array.from({ length: inventory.width }, () => undefined),
  );

  for (const entry of inventory.entries) {
    if (ignoreEntryId && entry.entryId === ignoreEntryId) {
      continue;
    }
    const footprint = footprintForItem(catalog, entry.payload.itemId);
    if (!footprint) {
      continue;
    }
    markOccupancy(grid, entry, footprint);
  }

  return grid;
}

export function canPlaceAt(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
  x: number,
  y: number,
  rotation: Rotation,
  ignoreEntryId?: string,
): PlaceResult {
  if (rotation !== 0 && rotation !== 90) {
    return { ok: false, reason: 'invalid_rotation' };
  }
  const footprint = footprintForItem(catalog, itemId);
  if (!footprint) {
    return { ok: false, reason: 'unknown_item' };
  }
  const size = effectiveFootprint(footprint.width, footprint.height, rotation);
  if (x < 0 || y < 0 || x + size.width > inventory.width || y + size.height > inventory.height) {
    return { ok: false, reason: 'out_of_bounds' };
  }

  const grid = occupancyGrid(inventory, catalog, ignoreEntryId);
  for (let dy = 0; dy < size.height; dy += 1) {
    for (let dx = 0; dx < size.width; dx += 1) {
      if (grid[y + dy]?.[x + dx] !== undefined) {
        return { ok: false, reason: 'collision' };
      }
    }
  }
  return { ok: true };
}

export function findFirstFit(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
): { x: number; y: number; rotation: Rotation } | undefined {
  for (const rotation of [0, 90] as const) {
    for (let y = 0; y < inventory.height; y += 1) {
      for (let x = 0; x < inventory.width; x += 1) {
        if (canPlaceAt(inventory, catalog, itemId, x, y, rotation).ok) {
          return { x, y, rotation };
        }
      }
    }
  }
  return undefined;
}

function findStackEntry(
  inventory: InventoryState,
  itemId: ItemId,
): PlacedInventoryEntry | undefined {
  return inventory.entries.find(
    (entry) => entry.payload.kind === 'stack' && entry.payload.itemId === itemId,
  );
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

  // Simulate on a shallow clone of placement list.
  const sim: InventoryState = {
    width: inventory.width,
    height: inventory.height,
    entries: inventory.entries.map((entry) => ({
      ...entry,
      payload:
        entry.payload.kind === 'stack'
          ? { ...entry.payload }
          : { ...entry.payload, state: entry.payload.state ? { ...entry.payload.state } : undefined },
    })),
  };

  let added = 0;
  for (let index = 0; index < quantity; index += 1) {
    const result = addOneUnit(sim, catalog, itemId);
    if (!result.ok) {
      break;
    }
    added += 1;
  }
  return added;
}

function addOneUnit(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
): PlaceResult {
  const def = catalog[itemId];
  if (!def) {
    return { ok: false, reason: 'unknown_item' };
  }

  if (!requiresItemInstance(def.fragments, def.maxStack)) {
    const existing = findStackEntry(inventory, itemId);
    if (existing && existing.payload.kind === 'stack' && existing.payload.quantity < def.maxStack) {
      existing.payload.quantity += 1;
      return { ok: true };
    }
  }

  const fit = findFirstFit(inventory, catalog, itemId);
  if (!fit) {
    return { ok: false, reason: 'inventory_full' };
  }

  const payload: InventoryPayload = requiresItemInstance(def.fragments, def.maxStack)
    ? {
        kind: 'instance',
        itemId,
        instanceId: createInstanceId(),
        state: createInitialInstanceState(def.fragments),
      }
    : { kind: 'stack', itemId, quantity: 1 };

  inventory.entries.push({
    entryId: createEntryId(),
    payload,
    x: fit.x,
    y: fit.y,
    rotation: fit.rotation,
  });
  return { ok: true };
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

  let added = 0;
  for (let index = 0; index < quantity; index += 1) {
    const result = addOneUnit(inventory, catalog, itemId);
    if (!result.ok) {
      return {
        ok: false,
        added,
        reason: result.reason === 'unknown_item' ? 'unknown_item' : 'inventory_full',
      };
    }
    added += 1;
  }
  return { ok: true, added };
}

export function placeLootAt(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
  quantity: number,
  x: number,
  y: number,
  rotation: Rotation,
): InventoryAddResult {
  const def = catalog[itemId];
  if (!def) {
    return { ok: false, added: 0, reason: 'unknown_item' };
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, added: 0, reason: 'invalid_quantity' };
  }

  if (!requiresItemInstance(def.fragments, def.maxStack)) {
    const existing = findStackEntry(inventory, itemId);
    if (existing && existing.payload.kind === 'stack') {
      const room = def.maxStack - existing.payload.quantity;
      if (room > 0) {
        const merged = Math.min(room, quantity);
        existing.payload.quantity += merged;
        if (merged === quantity) {
          return { ok: true, added: quantity };
        }
        const rest = addToInventory(inventory, catalog, itemId, quantity - merged);
        return { ok: rest.ok, added: merged + rest.added, reason: rest.reason };
      }
    }

    const check = canPlaceAt(inventory, catalog, itemId, x, y, rotation);
    if (!check.ok) {
      return { ok: false, added: 0, reason: check.reason };
    }
    const chunk = Math.min(quantity, def.maxStack);
    inventory.entries.push({
      entryId: createEntryId(),
      payload: { kind: 'stack', itemId, quantity: chunk },
      x,
      y,
      rotation,
    });
    if (chunk < quantity) {
      const rest = addToInventory(inventory, catalog, itemId, quantity - chunk);
      return { ok: rest.ok, added: chunk + rest.added, reason: rest.reason };
    }
    return { ok: true, added: quantity };
  }

  // Non-stackable / instance: place first at requested cell, rest auto-place.
  const check = canPlaceAt(inventory, catalog, itemId, x, y, rotation);
  if (!check.ok) {
    return { ok: false, added: 0, reason: check.reason };
  }
  inventory.entries.push({
    entryId: createEntryId(),
    payload: {
      kind: 'instance',
      itemId,
      instanceId: createInstanceId(),
      state: createInitialInstanceState(def.fragments),
    },
    x,
    y,
    rotation,
  });
  if (quantity === 1) {
    return { ok: true, added: 1 };
  }
  const rest = addToInventory(inventory, catalog, itemId, quantity - 1);
  return { ok: rest.ok, added: 1 + rest.added, reason: rest.reason };
}

export function moveInventoryEntry(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  entryId: string,
  x: number,
  y: number,
  rotation: Rotation,
): PlaceResult {
  const entry = inventory.entries.find((candidate) => candidate.entryId === entryId);
  if (!entry) {
    return { ok: false, reason: 'unknown_entry' };
  }
  const check = canPlaceAt(inventory, catalog, entry.payload.itemId, x, y, rotation, entryId);
  if (!check.ok) {
    return check;
  }
  entry.x = x;
  entry.y = y;
  entry.rotation = rotation;
  return { ok: true };
}

export function discardInventoryEntry(inventory: InventoryState, entryId: string): boolean {
  const index = inventory.entries.findIndex((entry) => entry.entryId === entryId);
  if (index < 0) {
    return false;
  }
  inventory.entries.splice(index, 1);
  return true;
}

/** @deprecated Prefer discardInventoryEntry by entryId. */
export function discardInventorySlot(inventory: InventoryState, slotIndex: number): boolean {
  const entry = inventory.entries[slotIndex];
  if (!entry) {
    return false;
  }
  return discardInventoryEntry(inventory, entry.entryId);
}

export function tidyInventory(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
): PlaceResult {
  const snapshot = inventory.entries.map((entry) => ({
    ...entry,
    payload:
      entry.payload.kind === 'stack'
        ? { ...entry.payload }
        : {
            ...entry.payload,
            state: entry.payload.state?.durability
              ? { durability: { ...entry.payload.state.durability } }
              : entry.payload.state,
          },
  }));

  const sorted = [...snapshot].sort((left, right) => {
    const leftFoot = footprintForItem(catalog, left.payload.itemId) ?? { width: 1, height: 1 };
    const rightFoot = footprintForItem(catalog, right.payload.itemId) ?? { width: 1, height: 1 };
    const leftArea = leftFoot.width * leftFoot.height;
    const rightArea = rightFoot.width * rightFoot.height;
    if (rightArea !== leftArea) {
      return rightArea - leftArea;
    }
    const leftMax = Math.max(leftFoot.width, leftFoot.height);
    const rightMax = Math.max(rightFoot.width, rightFoot.height);
    if (rightMax !== leftMax) {
      return rightMax - leftMax;
    }
    return left.entryId.localeCompare(right.entryId);
  });

  inventory.entries = [];
  for (const entry of sorted) {
    const fit = findFirstFit(inventory, catalog, entry.payload.itemId);
    if (!fit) {
      inventory.entries = snapshot;
      return { ok: false, reason: 'inventory_full' };
    }
    inventory.entries.push({
      ...entry,
      x: fit.x,
      y: fit.y,
      rotation: fit.rotation,
    });
  }
  return { ok: true };
}

export type InventorySlotView = {
  slotIndex: number;
  entryId: string;
  itemId: ItemId;
  name: string;
  quantity: number;
  sellValue: number;
  label: string;
  x: number;
  y: number;
  rotation: Rotation;
  width: number;
  height: number;
};

export function listInventorySlots(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
): InventorySlotView[] {
  return inventory.entries.map((entry, slotIndex) => {
    const def = catalog[entry.payload.itemId];
    const name = def?.name ?? entry.payload.itemId;
    const sellValue = def?.sellValue ?? 0;
    const footprint = getItemFootprint(def?.fragments ?? []);
    const size = effectiveFootprint(footprint.width, footprint.height, entry.rotation);
    if (entry.payload.kind === 'stack') {
      return {
        slotIndex,
        entryId: entry.entryId,
        itemId: entry.payload.itemId,
        name,
        quantity: entry.payload.quantity,
        sellValue,
        label: `${name} x${entry.payload.quantity}`,
        x: entry.x,
        y: entry.y,
        rotation: entry.rotation,
        width: size.width,
        height: size.height,
      };
    }
    const durability = entry.payload.state?.durability;
    const durabilityMax = def?.fragments.find((fragment) => fragment.kind === 'durability');
    const maxDurability =
      durabilityMax?.kind === 'durability' ? durabilityMax.max : (durability?.current ?? 0);
    const durabilitySuffix =
      durability !== undefined ? ` (${durability.current}/${maxDurability} dur)` : '';
    return {
      slotIndex,
      entryId: entry.entryId,
      itemId: entry.payload.itemId,
      name,
      quantity: 1,
      sellValue,
      label: `${name}${durabilitySuffix}`,
      x: entry.x,
      y: entry.y,
      rotation: entry.rotation,
      width: size.width,
      height: size.height,
    };
  });
}

export type InventoryGridCell = {
  glyph: string;
  entryId?: string;
  selected?: boolean;
};

export function renderInventoryGrid(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  selectedEntryId?: string,
): InventoryGridCell[][] {
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const glyphByEntry = new Map<string, string>();
  inventory.entries.forEach((entry, index) => {
    glyphByEntry.set(entry.entryId, glyphs[index % glyphs.length] ?? '?');
  });

  const grid = occupancyGrid(inventory, catalog);
  return grid.map((row) =>
    row.map((entryId) => {
      if (!entryId) {
        return { glyph: '.' };
      }
      return {
        glyph: glyphByEntry.get(entryId) ?? '?',
        entryId,
        selected: entryId === selectedEntryId,
      };
    }),
  );
}
