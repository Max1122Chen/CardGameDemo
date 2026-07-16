import type { ItemDefinition, ItemId } from './item-definition.js';
import { getEquipmentFragment } from './fragments.js';
import {
  findFirstFit,
  placePayloadInInventory,
  takeInventoryEntry,
  type InventoryPayload,
  type InventoryState,
} from './inventory.js';

export const EQUIPMENT_SLOT_IDS = [
  'Hand.Main',
  'Hand.Off',
  'Head',
  'Chest',
  'Legs',
  'Feet',
] as const;

export type EquipmentSlotId = (typeof EQUIPMENT_SLOT_IDS)[number];

export type EquippedPiece = {
  entryId: string;
  itemId: ItemId;
  payload: InventoryPayload;
  occupiedSlots: readonly EquipmentSlotId[];
};

export type EquipmentLoadout = {
  /** slot -> entryId (two-hand required: both hands map to same entryId) */
  slotOf: Partial<Record<EquipmentSlotId, string>>;
  pieces: Record<string, EquippedPiece>;
};

export type EquipFailureReason =
  | 'unknown_entry'
  | 'not_equipment'
  | 'not_instance'
  | 'no_free_slot'
  | 'hands_busy'
  | 'inventory_full'
  | 'unknown_piece'
  | 'unknown_item';

export type EquipResult =
  | { ok: true; piece: EquippedPiece }
  | { ok: false; reason: EquipFailureReason };

export function createEquipmentLoadout(): EquipmentLoadout {
  return { slotOf: {}, pieces: {} };
}

function isEquipmentSlotId(value: string): value is EquipmentSlotId {
  return (EQUIPMENT_SLOT_IDS as readonly string[]).includes(value);
}

function slotFree(loadout: EquipmentLoadout, slot: EquipmentSlotId): boolean {
  return loadout.slotOf[slot] === undefined;
}

function clonePayload(payload: InventoryPayload): InventoryPayload {
  if (payload.kind === 'stack') {
    return { ...payload };
  }
  return {
    ...payload,
    state: payload.state?.durability
      ? { durability: { ...payload.state.durability } }
      : payload.state,
  };
}

export function listEquippedPieces(loadout: EquipmentLoadout): EquippedPiece[] {
  const seen = new Set<string>();
  const pieces: EquippedPiece[] = [];
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const entryId = loadout.slotOf[slot];
    if (!entryId || seen.has(entryId)) {
      continue;
    }
    seen.add(entryId);
    const piece = loadout.pieces[entryId];
    if (piece) {
      pieces.push(piece);
    }
  }
  return pieces;
}

export function equipFromInventory(
  loadout: EquipmentLoadout,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  entryId: string,
): EquipResult {
  const placed = inventory.entries.find((entry) => entry.entryId === entryId);
  if (!placed) {
    return { ok: false, reason: 'unknown_entry' };
  }

  const def = catalog[placed.payload.itemId];
  if (!def) {
    return { ok: false, reason: 'unknown_item' };
  }

  const equipment = getEquipmentFragment(def.fragments);
  if (!equipment) {
    return { ok: false, reason: 'not_equipment' };
  }

  if (placed.payload.kind !== 'instance') {
    return { ok: false, reason: 'not_instance' };
  }

  const compatibleSlots = equipment.slots.filter(isEquipmentSlotId);
  if (compatibleSlots.length === 0) {
    return { ok: false, reason: 'no_free_slot' };
  }

  let occupiedSlots: EquipmentSlotId[];

  if (equipment.twoHandMode === 'required') {
    if (!slotFree(loadout, 'Hand.Main') || !slotFree(loadout, 'Hand.Off')) {
      return { ok: false, reason: 'hands_busy' };
    }
    occupiedSlots = ['Hand.Main', 'Hand.Off'];
  } else {
    const freeSlot = compatibleSlots.find((slot) => slotFree(loadout, slot));
    if (!freeSlot) {
      return { ok: false, reason: 'no_free_slot' };
    }
    occupiedSlots = [freeSlot];
  }

  const taken = takeInventoryEntry(inventory, entryId);
  if (!taken) {
    return { ok: false, reason: 'unknown_entry' };
  }

  const piece: EquippedPiece = {
    entryId: taken.entryId,
    itemId: taken.payload.itemId,
    payload: clonePayload(taken.payload),
    occupiedSlots,
  };

  loadout.pieces[piece.entryId] = piece;
  for (const slot of occupiedSlots) {
    loadout.slotOf[slot] = piece.entryId;
  }

  return { ok: true, piece };
}

export function unequipToInventory(
  loadout: EquipmentLoadout,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  entryId: string,
): EquipResult {
  const piece = loadout.pieces[entryId];
  if (!piece) {
    return { ok: false, reason: 'unknown_piece' };
  }

  if (!findFirstFit(inventory, catalog, piece.itemId)) {
    return { ok: false, reason: 'inventory_full' };
  }

  for (const slot of piece.occupiedSlots) {
    if (loadout.slotOf[slot] === entryId) {
      delete loadout.slotOf[slot];
    }
  }
  delete loadout.pieces[entryId];

  const place = placePayloadInInventory(inventory, catalog, clonePayload(piece.payload), piece.entryId);
  if (!place.ok) {
    // Should be rare after findFirstFit; restore loadout if place failed.
    loadout.pieces[entryId] = piece;
    for (const slot of piece.occupiedSlots) {
      loadout.slotOf[slot] = entryId;
    }
    return { ok: false, reason: place.reason === 'inventory_full' ? 'inventory_full' : 'inventory_full' };
  }

  return { ok: true, piece };
}

export type EquipmentSlotView = {
  slotId: EquipmentSlotId;
  entryId?: string;
  itemId?: ItemId;
  name?: string;
  label: string;
};

export function listEquipmentSlots(
  loadout: EquipmentLoadout,
  catalog: Record<ItemId, ItemDefinition>,
): EquipmentSlotView[] {
  return EQUIPMENT_SLOT_IDS.map((slotId) => {
    const entryId = loadout.slotOf[slotId];
    if (!entryId) {
      return { slotId, label: `${slotId}: (empty)` };
    }
    const piece = loadout.pieces[entryId];
    const name = catalog[piece?.itemId ?? '']?.name ?? piece?.itemId ?? entryId;
    const dual = piece && piece.occupiedSlots.length > 1 ? ' [2H]' : '';
    return {
      slotId,
      entryId,
      itemId: piece?.itemId,
      name,
      label: `${slotId}: ${name}${dual}`,
    };
  });
}
