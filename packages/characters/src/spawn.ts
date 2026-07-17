import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  EQUIPMENT_SLOT_IDS,
  addToInventory,
  buildDeckIdsFromLoadout,
  createEquipmentLoadout,
  createInventory,
  getEquipmentFragment,
  placeLootAt,
  takeInventoryEntry,
  type EquipmentLoadout,
  type EquipmentSlotId,
  type InventoryPayload,
  type InventoryState,
  type ItemDefinition,
  type ItemId,
  type Rotation,
} from '@cardgame/items';

import { CharacterSpawnError } from './errors.js';
import type {
  CharacterDefinition,
  CharacterEquipmentSpawn,
  CharacterInstance,
  SpawnContext,
} from './types.js';

import type { WireCharacterDefinition } from './parse-character.js';

function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (true) {
    if (existsSync(join(dir, 'data', 'characters'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  throw new Error('Could not locate repo root (missing data/characters)');
}

export function resolveRepoDataRoot(startDir = dirname(fileURLToPath(import.meta.url))): string {
  return join(findRepoRoot(startDir), 'data');
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function loadCharacterWiresFromDir(charactersDir: string): WireCharacterDefinition[] {
  if (!existsSync(charactersDir)) {
    return [];
  }
  return readdirSync(charactersDir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => readJsonFile(join(charactersDir, name)));
}

export function loadBehaviorTreeIds(dataRoot: string): Set<string> {
  const dir = join(dataRoot, 'behavior-trees');
  if (!existsSync(dir)) {
    return new Set();
  }
  const ids = new Set<string>();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    const wire = readJsonFile<{ id?: string }>(join(dir, name));
    if (wire.id) {
      ids.add(wire.id);
    }
  }
  return ids;
}

function isEquipmentSlotId(value: string): value is EquipmentSlotId {
  return (EQUIPMENT_SLOT_IDS as readonly string[]).includes(value);
}

function clonePayload(payload: InventoryPayload): InventoryPayload {
  if (payload.kind === 'stack') {
    return { kind: 'stack', itemId: payload.itemId, quantity: payload.quantity };
  }
  return {
    kind: 'instance',
    itemId: payload.itemId,
    instanceId: payload.instanceId,
    state: payload.state ? { ...payload.state } : undefined,
  };
}

function slotFree(loadout: EquipmentLoadout, slot: EquipmentSlotId): boolean {
  return loadout.slotOf[slot] === undefined;
}

function equipEntryAtSlot(
  loadout: EquipmentLoadout,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  entryId: string,
  preferredSlot?: string,
): void {
  const placed = inventory.entries.find((entry) => entry.entryId === entryId);
  if (!placed) {
    throw new CharacterSpawnError(`Unknown inventory entry: ${entryId}`);
  }

  const def = catalog[placed.payload.itemId];
  if (!def) {
    throw new CharacterSpawnError(`Unknown item: ${placed.payload.itemId}`);
  }

  const equipment = getEquipmentFragment(def.fragments);
  if (!equipment) {
    throw new CharacterSpawnError(`Item is not equipment: ${placed.payload.itemId}`);
  }
  if (placed.payload.kind !== 'instance') {
    throw new CharacterSpawnError(`Equipment must be instance payload: ${placed.payload.itemId}`);
  }

  const compatibleSlots = equipment.slots.filter(isEquipmentSlotId);
  let occupiedSlots: EquipmentSlotId[];

  if (equipment.twoHandMode === 'required') {
    if (!slotFree(loadout, 'Hand.Main') || !slotFree(loadout, 'Hand.Off')) {
      throw new CharacterSpawnError('Hands busy during spawn equip');
    }
    occupiedSlots = ['Hand.Main', 'Hand.Off'];
  } else {
    let freeSlot: EquipmentSlotId | undefined;
    if (preferredSlot && isEquipmentSlotId(preferredSlot) && compatibleSlots.includes(preferredSlot)) {
      if (slotFree(loadout, preferredSlot)) {
        freeSlot = preferredSlot;
      }
    }
    if (!freeSlot) {
      freeSlot = compatibleSlots.find((slot) => slotFree(loadout, slot));
    }
    if (!freeSlot) {
      throw new CharacterSpawnError(`No free slot for ${placed.payload.itemId}`);
    }
    occupiedSlots = [freeSlot];
  }

  const taken = takeInventoryEntry(inventory, entryId);
  if (!taken) {
    throw new CharacterSpawnError(`Could not take entry ${entryId} from inventory`);
  }

  const piece = {
    entryId: taken.entryId,
    itemId: taken.payload.itemId,
    payload: clonePayload(taken.payload),
    occupiedSlots,
  };
  loadout.pieces[piece.entryId] = piece;
  for (const slot of occupiedSlots) {
    loadout.slotOf[slot] = piece.entryId;
  }
}

function addEquipmentToBag(
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  itemId: ItemId,
): string {
  const add = addToInventory(inventory, catalog, itemId, 1);
  if (!add.ok) {
    throw new CharacterSpawnError(`Could not add equipment ${itemId} to spawn inventory: ${add.reason ?? 'failed'}`);
  }
  const entry = [...inventory.entries]
    .reverse()
    .find((candidate) => candidate.payload.itemId === itemId);
  if (!entry) {
    throw new CharacterSpawnError(`Spawn inventory missing entry for ${itemId}`);
  }
  return entry.entryId;
}

function equipSpawnPiece(
  loadout: EquipmentLoadout,
  inventory: InventoryState,
  catalog: Record<ItemId, ItemDefinition>,
  piece: CharacterEquipmentSpawn,
): void {
  const entryId = addEquipmentToBag(inventory, catalog, piece.itemId);
  equipEntryAtSlot(loadout, inventory, catalog, entryId, piece.slot);
}

export function spawnCharacterInstance(
  definition: CharacterDefinition,
  context: SpawnContext,
): CharacterInstance {
  const { itemCatalog, behaviorTreeIds } = context;
  if (behaviorTreeIds && !behaviorTreeIds.has(definition.behaviorTreeId)) {
    throw new CharacterSpawnError(`Unknown behaviorTreeId: ${definition.behaviorTreeId}`);
  }

  for (const piece of definition.equipment) {
    if (!itemCatalog[piece.itemId]) {
      throw new CharacterSpawnError(`Unknown equipment itemId: ${piece.itemId}`);
    }
  }
  for (const piece of definition.inventory) {
    if (!itemCatalog[piece.itemId]) {
      throw new CharacterSpawnError(`Unknown inventory itemId: ${piece.itemId}`);
    }
  }
  for (const entry of definition.loot.entries) {
    if (!itemCatalog[entry.itemId]) {
      throw new CharacterSpawnError(`Unknown loot itemId: ${entry.itemId}`);
    }
  }

  const loadout = createEquipmentLoadout();
  const inventory = createInventory(
    definition.inventoryWidth ?? 4,
    definition.inventoryHeight ?? 6,
  );

  for (const piece of definition.equipment) {
    equipSpawnPiece(loadout, inventory, itemCatalog, piece);
  }

  for (const piece of definition.inventory) {
    const quantity = piece.quantity ?? 1;
    const rotation = (piece.rotation ?? 0) as Rotation;
    const place = placeLootAt(inventory, itemCatalog, piece.itemId, quantity, piece.x, piece.y, rotation);
    if (!place.ok) {
      throw new CharacterSpawnError(
        `Could not place ${piece.itemId} at (${piece.x},${piece.y}): ${place.reason ?? 'failed'}`,
      );
    }
  }

  const deckIds = buildDeckIdsFromLoadout([], loadout, itemCatalog);

  return {
    definitionId: definition.id,
    displayName: definition.name,
    primaries: { ...definition.primaries },
    maxHealth: definition.maxHealth,
    maxActionPoints: definition.maxActionPoints,
    loadout,
    inventory,
    deckIds,
    behaviorTreeId: definition.behaviorTreeId,
    loot: {
      entries: definition.loot.entries.map((entry) => ({ ...entry })),
    },
  };
}

export function spawnCharacterById(
  catalog: Record<string, CharacterDefinition>,
  characterId: string,
  context: SpawnContext,
): CharacterInstance {
  const definition = catalog[characterId];
  if (!definition) {
    throw new CharacterSpawnError(`Unknown character id: ${characterId}`);
  }
  return spawnCharacterInstance(definition, context);
}
